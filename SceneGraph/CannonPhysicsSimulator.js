CannonPhysicsSimulator.prototype = new Evaluator();
CannonPhysicsSimulator.prototype.constructor = CannonPhysicsSimulator;

function CannonPhysicsSimulator()
{
    Evaluator.call(this);
    this.className = "CannonPhysicsSimulator";
    this.attrType = eAttrType.CannonPhysicsSimulator;

    this.collisionConfiguration = null;
    this.dispatcher = null;
    this.overlappingPairCache = null;
    this.solver = null;
    this.world = null;
    this.physicsBodies = [];
    this.bodyAdded = [];
    this.bodyModels = [];
    this.updateWorld = false;
    this.updateBodies = false;

    this.timeIncrement = new NumberAttr(0);
    this.timeScale = new NumberAttr(1);
    this.gravity = new Vector3DAttr(0, -9.8, 0);
    this.worldHalfExtents = new Vector3DAttr(10000, 10000, 10000); // TODO: does this need to be configurable? 
    this.bodies = new AttributeVector(new StringAttrAllocator());

    this.bodies.getAttribute("appendParsedElements").setValueDirect(true);

    this.gravity.addModifiedCB(CannonPhysicsSimulator_GravityModifiedCB, this);
    this.bodies.addModifiedCB(CannonPhysicsSimulator_BodiesModifiedCB, this);

    this.registerAttribute(this.timeIncrement, "timeIncrement");
    this.registerAttribute(this.timeScale, "timeScale");
    this.registerAttribute(this.gravity, "gravity");
    this.registerAttribute(this.worldHalfExtents, "worldHalfExtents");
    this.registerAttribute(this.bodies, "bodies");

    this.initPhysics();
}

CannonPhysicsSimulator.prototype.evaluate = function()
{
    var timeIncrement = this.timeIncrement.getValueDirect() * this.timeScale.getValueDirect();
    this.stepSimulation(timeIncrement);

    // add/remove bodies based on selection state (allows for object inspection)
    for (var i = 0; i < this.bodyModels.length; i++)
    {
        switch (this.isSelected(this.bodyModels[i]))
        {
            case 0:
                // unselected
                {
                    // if not added, restore
                    if (!this.bodyAdded[i])
                    {
                        this.updatePhysicsBody(i);
                    }
                }
                break;

            case 1:
                // selected
                {
                    // stop positional updates
                    this.bodyAdded[i] = false;
                }
                break;
        }
    }

    var worldHalfExtents = this.worldHalfExtents.getValueDirect();
    var modelsOutOfBounds = [];
    for (var i = 0; i < this.physicsBodies.length; i++)
    {
        var physicsEnabled = this.bodyModels[i].physicsEnabled.getValueDirect();
        if (!this.bodyAdded[i] || !physicsEnabled)
            continue;

        var body = this.physicsBodies[i];
        
        var position = body.position;

        var rotation = body.quaternion;
        var quat = new Quaternion();
        quat.load(rotation.w, rotation.x, rotation.y, rotation.z);

        this.bodyModels[i].getAttribute("sectorPosition").setValueDirect(position.x, position.y, position.z);
        this.bodyModels[i].getAttribute("quaternion").setValueDirect(quat);

        // if object has moved outside of the world boundary, remove it from the simulation (memory errors occur when positions become too large)
        if (position.x < -worldHalfExtents.x || position.x > worldHalfExtents.x ||
            position.y < -worldHalfExtents.y || position.y > worldHalfExtents.y ||
            position.z < -worldHalfExtents.z || position.z > worldHalfExtents.z)
        {
            modelsOutOfBounds.push(this.bodyModels[i]);
        }
    }

    // remove any models that have moved outside of the world boundary
    for (var i = 0; i < modelsOutOfBounds.length; i++)
    {
        this.deletePhysicsBody(modelsOutOfBounds[i]);
    }
}

CannonPhysicsSimulator.prototype.update = function()
{
    if (this.updateWorld)
    {
        this.updateWorld = false;
        this.updateBodies = true;
        this.initPhysics();
    }

    if (this.updateBodies)
    {
        this.updateBodies = false;
        this.updatePhysicsBodies();
    }
}

CannonPhysicsSimulator.prototype.stepSimulation = function(timeIncrement, maxSubSteps)
{
    maxSubSteps = maxSubSteps || 10;
    
    this.update();
    this.world.step(timeIncrement);//, maxSubSteps);
}

CannonPhysicsSimulator.prototype.isColliding = function(model)
{
    // if model is parented, get parent
    while (model.motionParent)
    {
        model = model.motionParent;
    }
    
    // find physics body corresponding to model
    var physicsBody = this.getPhysicsBody(model);
    if (physicsBody)
    {
        var numManifolds = this.world.getDispatcher().getNumManifolds();
        for (var i = 0; i < numManifolds; i++)
        {
            var contactManifold = this.world.getDispatcher().getManifoldByIndexInternal(i);
            var body0 = contactManifold.getBody0();
            var body1 = contactManifold.getBody1();
            
            //var distance = FLT_MAX;
            var numContacts = contactManifold.getNumContacts();
            /*for (var j = 0; j < numContacts; j++)
            {
                var pt = contactManifold.getContactPoint(j);
                var ptA = pt.getPositionWorldOnA();
                var ptB = pt.getPositionWorldOnB();

                var distance = Math.min(distanceBetween(new Vector3D(ptA.x(), ptA.y(), ptA.z()), new Vector3D(ptB.x(), ptB.y(), ptB.z()), distance));
                //console.log(distance);               
            }
            */
            //if (distance < 0.05)
            if (numContacts > 0)
            {
                if (body0.ptr == physicsBody.ptr)
                {
                    return true;
                }
                else if (body1.ptr == physicsBody.ptr)
                {
                    return true;
                }
            }
        }
    }

    return false;
}

CannonPhysicsSimulator.prototype.getColliders = function(model)
{
    var colliders = [];

    // if model is parented, get parent
    while (model.motionParent)
    {
        model = model.motionParent;
    }

    // find physics body corresponding to model
    var physicsBody = this.getPhysicsBody(model);
    if (physicsBody)
    {
        var numManifolds = this.world.getDispatcher().getNumManifolds();
        for (var i = 0; i < numManifolds; i++)
        {
            var contactManifold = this.world.getDispatcher().getManifoldByIndexInternal(i);
            var body0 = contactManifold.getBody0();
            var body1 = contactManifold.getBody1();
            
            //var distance = FLT_MAX;
            var numContacts = contactManifold.getNumContacts();
            /*for (var j = 0; j < numContacts; j++)
            {
                var pt = contactManifold.getContactPoint(j);
                var ptA = pt.getPositionWorldOnA();
                var ptB = pt.getPositionWorldOnB();

                var distance = Math.min(distanceBetween(new Vector3D(ptA.x(), ptA.y(), ptA.z()), new Vector3D(ptB.x(), ptB.y(), ptB.z()), distance));
                //console.log(distance);               
            }
            */
            //if (distance < 0.05)
            if (numContacts > 0)
            {
                if (body0.ptr == physicsBody.ptr)
                {
                    colliders.push(this.getBodyModel(body1));
                }
                else if (body1.ptr == physicsBody.ptr)
                {
                    colliders.push(this.getBodyModel(body0));
                }
            }
        }
    }

    return colliders;
}

CannonPhysicsSimulator.prototype.getPhysicsBody = function(bodyModel)
{
    for (var i = 0; i < this.bodyModels.length; i++)
    {
        if (this.bodyModels[i] == bodyModel)
        {
            return this.physicsBodies[i];
        }
    }

    return null;
}

CannonPhysicsSimulator.prototype.getBodyModel = function(physicsBody)
{
    for (var i = 0; i < this.physicsBodies.length; i++)
    {
        if (this.physicsBodies[i].ptr == physicsBody.ptr)
        {
            return this.bodyModels[i];
        }
    }

    return null;
}

CannonPhysicsSimulator.prototype.isSelected = function(model)
{
    var selected = model.getAttribute("selected").getValueDirect();
    if (!selected)
    {
        for (var i = 0; i < model.motionChildren.length && !selected; i++)
        {
            selected = this.isSelected(model.motionChildren[i]);
        }
    }

    return selected;
}

CannonPhysicsSimulator.prototype.updatePhysicsBodies = function()
{
    // remove existing bodies
    while (this.bodyModels.length > 0)
    {
        this.deletePhysicsBody(this.bodyModels[0]);
    }

    // add bodies to world (if not already present)
    for (var i = 0; i < this.bodies.Size(); i++)
    {
        var name = this.bodies.getAt(i).getValueDirect().join("");
        var model = this.registry.find(name);
        if (model)
        {
            this.createPhysicsBody(model);
        }
    }
}

CannonPhysicsSimulator.prototype.createPhysicsBody = function(model)
{
    if (!model)
        return;

    // watch for changes in vertices
    model.getAttribute("vertices").addModifiedCB(CannonPhysicsSimulator_ModelVerticesModifiedCB, this);
    // watch for changes in scale
    model.getAttribute("scale").addModifiedCB(CannonPhysicsSimulator_ModelScaleModifiedCB, this);
    // watch for changes in parent
    model.getAttribute("parent").addModifiedCB(CannonPhysicsSimulator_ModelParentModifiedCB, this);
    // watch for changes in enabled
    model.getAttribute("enabled").removeModifiedCB(CannonPhysicsSimulator_ModelEnabledModifiedCB, this); // ensure no dups (not removed by delete)
    model.getAttribute("enabled").addModifiedCB(CannonPhysicsSimulator_ModelEnabledModifiedCB, this);

    // if model is disabled, don't create
    if (model.getAttribute("enabled").getValueDirect() == false)
        return;
    
    // if model is parented, don't add here; it will be added as a shape to the parent model's body
    if (model.motionParent)
        return;

    var mass = this.getNetMass(model);

    var body = new CANNON.Body({
        mass: mass
    });

    this.getCompoundShape(model, body);
    
    var position = model.getAttribute("sectorPosition").getValueDirect();
    // temporary fix to remove y-axis padding between static and dynamic objects
    if (mass == 0)
    {
        //position.y -= 0.075;
    }
    body.position.x = position.x;
    body.position.y = position.y;
    body.position.z = position.z;

    var rotation = model.getAttribute("quaternion").getValueDirect();
    body.quaternion.x = rotation.x;
    body.quaternion.y = rotation.y;
    body.quaternion.z = rotation.z;
    body.quaternion.w = rotation.w;

    this.world.addBody(body);
    //if (isDynamic)
    {
        this.bodyModels.push(model);
        this.physicsBodies.push(body);
        this.bodyAdded.push(true);
    }
}

CannonPhysicsSimulator.prototype.deletePhysicsBody = function(model)
{
    for (var i = 0; i < this.bodyModels.length; i++)
    {
        if (this.bodyModels[i] == model)
        {
            this.bodyModels[i].getAttribute("vertices").removeModifiedCB(CannonPhysicsSimulator_ModelVerticesModifiedCB, this);
            this.bodyModels[i].getAttribute("scale").removeModifiedCB(CannonPhysicsSimulator_ModelScaleModifiedCB, this);
            this.bodyModels[i].getAttribute("parent").removeModifiedCB(CannonPhysicsSimulator_ModelParentModifiedCB, this);
            //this.bodyModels[i].getAttribute("enabled").removeModifiedCB(CannonPhysicsSimulator_ModelEnabledModifiedCB, this);
            this.world.removeBody(this.physicsBodies[i]);
            this.physicsBodies.splice(i, 1);
            this.bodyModels.splice(i, 1);
            this.bodyAdded.splice(i, 1);
            return;
        }
    }
}

CannonPhysicsSimulator.prototype.getCompoundShape = function(model, body)
{
    var position = new Vector3D();
    var rotation = new Vector3D();
    var scale = model.getAttribute("scale").getValueDirect();
    this.addCollisionShape(model, position, rotation, scale, body);
}

CannonPhysicsSimulator.prototype.addCollisionShape = function(model, position, rotation, scale, body)
{
    var center = model.getAttribute("center").getValueDirect();
            
    for (var i = 0; i < model.geometries.length; i++)
    {
        var shape = this.getCollisionShape(model.geometries[i], center, scale);
        if (shape)
        {
            var offset = new CANNON.Vec3(position.x, position.y, position.z);

            var quat = new Quaternion();
            quat.loadXYZAxisRotation(rotation.x, rotation.y, rotation.z);
            var quaternion = new CANNON.Quaternion(quat.x, quat.y, quat.z, quat.w);

            body.addShape(shape, offset, quaternion);
        }
    }

    // recurse on motion children
    for (var i = 0; i < model.motionChildren.length; i++)
    {
        var child = model.motionChildren[i];

        var childPosition = child.getAttribute("position").getValueDirect();
        childPosition.x += position.x;
        childPosition.y += position.y;
        childPosition.z += position.z;

        var childRotation = child.getAttribute("rotation").getValueDirect();
        childRotation.x += rotation.x;
        childRotation.y += rotation.y;
        childRotation.z += rotation.z;

        var childScale = child.getAttribute("scale").getValueDirect();
        childScale.x *= scale.x;
        childScale.y *= scale.y;
        childScale.z *= scale.z;

        this.addCollisionShape(child, childPosition, childRotation, childScale, body);
    }
}

CannonPhysicsSimulator.prototype.getCollisionShape = function(geometry, center, scale)
{
    var shape = null;
    
    // scale vertices
    var scaleMatrix = new Matrix4x4();
    scaleMatrix.loadScale(scale.x, scale.y, scale.z);

    var matrix = scaleMatrix;
    
    var points = [];
    var faces = [];
    var tris = geometry.getTriangles();
    for (var i = 0, j = 0; i < tris.length; i++, j+=3)
    {
        var tri = tris[i];
        var v0 = tri.v0;
        var v1 = tri.v1;
        var v2 = tri.v2;
        
        //var vert = matrix.transform(verts[i] - center.x, verts[i + 1] /*- center.y*/, verts[i + 2] - center.z, 1);
        var vert = matrix.transform(v0.x, v0.y, v0.z, 1);
        var point = new CANNON.Vec3(vert.x, vert.y, vert.z);
        points.push(point);
        
        vert = matrix.transform(v1.x, v1.y, v1.z, 1);
        point = new CANNON.Vec3(vert.x, vert.y, vert.z);
        points.push(point);
        
        vert = matrix.transform(v2.x, v2.y, v2.z, 1);
        point = new CANNON.Vec3(vert.x, vert.y, vert.z);
        points.push(point);
        
        faces.push([j, j+1, j+2]);
    }

    if (points.length > 0)
    {
        shape = new CANNON.ConvexPolyhedron(points, faces);
    }
    
    return shape;
}

CannonPhysicsSimulator.prototype.getNetMass = function(model)
{
    var mass = 0;

    // calculate scaled mass for model
    var scale = model.getAttribute("scale").getValueDirect();
    var avgScale = (scale.x + scale.y + scale.z) / 3;
    var physicalProperties = model.getAttribute("physicalProperties");
    var mass = physicalProperties.getAttribute("mass").getValueDirect() * avgScale;

    // add children's mass (if any)
    for (var i = 0; i < model.motionChildren.length; i++)
    {
        mass += this.getNetMass(model.motionChildren[i]);
    }

    return mass;
}

CannonPhysicsSimulator.prototype.updatePhysicsShape = function(model)
{
    // locate array position of model
    var n = -1;
    for (var i = 0; i < this.bodyModels.length; i++)
    {
        if (this.bodyModels[i] == model)
        {
            n = i;
            break;
        }
    }
    if (n == -1)
        return;

    var mass = this.getNetMass(model);

    var body = new CANNON.Body({
        mass: mass
    });

    this.getCompoundShape(model, body);
    
    // remove previous before adding
    this.world.removeBody(this.physicsBodies[n]);

    this.world.addBody(body);
    this.physicsBodies[n] = body;
}

CannonPhysicsSimulator.prototype.updatePhysicsBody = function(n)
{
    this.removePhysicsBody(n);
    this.restorePhysicsBody(n);
}

CannonPhysicsSimulator.prototype.removePhysicsBody = function(n)
{
    //if (!this.bodyAdded[n]) 
    //    return; // don't re-remove
    
    var body = this.physicsBodies[n];
    if (!body)
        return;

    this.world.removeBody(body);
    this.bodyAdded[n] = false;
}

CannonPhysicsSimulator.prototype.restorePhysicsBody = function(n)
{
    //if (this.bodyAdded[n]) 
    //    return; // don't re-restore
    
    var model = this.bodyModels[n];
    if (!model)
        return;
    var body = this.physicsBodies[n];
    if (!body)
        return;
    
    var position = model.getAttribute("sectorPosition").getValueDirect();
    body.position = new CANNON.Vec3(position.x, position.y, position.z);

    // update rotation to include rotation caused by object inspection
    var rotation = new Quaternion();
    var rotationGroup = getInspectionGroup(model);
    if (rotationGroup)
    {
        var rotationQuat = rotationGroup.getChild(2).getAttribute("rotationQuat").getValueDirect();
        var quat1 = new Quaternion();
        quat1.load(rotationQuat.w, rotationQuat.x, rotationQuat.y, rotationQuat.z);

        var modelQuat = model.getAttribute("quaternion").getValueDirect();
        var quat2 = new Quaternion();
        quat2.load(modelQuat.w, modelQuat.x, modelQuat.y, modelQuat.z);

        var quat = quat2.multiply(quat1);
        rotation.loadQuaternion(quat);
        
        // clear inspection group's rotation
        rotationGroup.getChild(2).getAttribute("rotationQuat").setValueDirect(new Quaternion());
    }   
    body.quaternion = new CANNON.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    this.world.addBody(body);
    this.bodyAdded[n] = true;
}

CannonPhysicsSimulator.prototype.initPhysics = function()
{
    var gravity = this.gravity.getValueDirect();
    
    this.world = new CANNON.World({
        //gravity: new CANNON.Vec3(gravity.x, gravity.y, gravity.z)
    });
    
    this.world.gravity = new CANNON.Vec3(gravity.x, gravity.y, gravity.z);
}

CannonPhysicsSimulator.prototype.bodiesModified = function()
{
    this.updateBodies = true;
}

CannonPhysicsSimulator.prototype.modelEnabledModified = function(model, enabled)
{
    if (enabled)
    {
        this.deletePhysicsBody(model); // ensure model is not added multiple times
        this.createPhysicsBody(model);
    }
    else // !enabled
    {
        this.deletePhysicsBody(model);
    }
}

function CannonPhysicsSimulator_GravityModifiedCB(attribute, container)
{
    if (container.world)
    {
        var gravity = attribute.getValueDirect();
        container.world.gravity = new CANNON.Vec3(gravity.x, gravity.y, gravity.z);
    }
}

function CannonPhysicsSimulator_BodiesModifiedCB(attribute, container)
{
    container.bodiesModified();
}

function CannonPhysicsSimulator_ModelVerticesModifiedCB(attribute, container)
{
    container.updatePhysicsShape(attribute.getContainer());
}

function CannonPhysicsSimulator_ModelScaleModifiedCB(attribute, container)
{
    container.updatePhysicsShape(attribute.getContainer());
}

function CannonPhysicsSimulator_ModelParentModifiedCB(attribute, container)
{
    container.updateBodies = true;
}

function CannonPhysicsSimulator_ModelEnabledModifiedCB(attribute, container)
{
    container.modelEnabledModified(attribute.getContainer(), attribute.getValueDirect());
}