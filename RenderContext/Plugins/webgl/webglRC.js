function gl_LightSourceParameters()
{
    var enabled;
    var ambient;
    var diffuse;
    var specular;
    var position;
    var spotDirection;
    var spotExponent;
    var spotCutoff;
    var constantAttenuation;
    var linearAttenuation;
    var quadraticAttenuation;
}

var gl_MaxLights = 8;

function gl_MaterialParameters()
{
    var ambient;
    var diffuse;
    var specular;
    var emission;
    var shininess; 
}

var gl_MaxTextureStages = 2;

webglRC.prototype = new RenderContext();
webglRC.prototype.constructor = webglRC;

function webglRC(canvas, background)
{
    //
    // initialization
    //
    
    RenderContext.call(this, canvas, background);
    
    var gl = getWebGLContext(canvas, false /*set to true for debug context*/);
    if (!gl) return;

    gl.clearColor(0, 0, 0, background ? 0 : 1);
    gl.clearDepth(1);
    gl.clearStencil(0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.STENCIL_TEST);
    gl.frontFace(gl.CW);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
   
    // create shaders
    var shaders = getShaders(gl, eShaderType.VertexLighting);
    if (!shaders.vertex || !shaders.fragment) return;

    // create program
    var program = getProgram(gl, shaders.vertex, shaders.fragment);
    if (!program) return;

    // set valid flag
    this.valid = true;

    // misc private members
    var vLightDescs = [];
    var vLightMatrices = [];
    var vLightEnabledStates = [];
    
    //
    // methods
    //
    
    this.applyModelViewTransform = function()
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.ApplyModelViewTransform, null);
        
        gl.uniformMatrix4fv(program.modelViewMatrix, false, new Float32Array(this.modelViewMatrixStack.top().flatten()));

        var normalMatrix = new Matrix4x4();
        normalMatrix.loadMatrix(this.modelViewMatrixStack.top());
        normalMatrix.invert();
        normalMatrix.transpose();
        gl.uniformMatrix4fv(program.normalMatrix, false, new Float32Array(normalMatrix.flatten()));
    }
    
    this.applyProjectionTransform = function()
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.ApplyProjectionTransform, null);
        
        gl.uniformMatrix4fv(program.projectionMatrix, false, new Float32Array(this.projectionMatrixStack.top().flatten()));
    }
    
    this.clear = function(mask)
    {
        mask = mask || (RC_COLOR_BUFFER_BIT | RC_DEPTH_BUFFER_BIT);
        
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.Clear, [mask]);
        
        gl.clear((mask & RC_COLOR_BUFFER_BIT   ? gl.COLOR_BUFFER_BIT   : 0) |
                 (mask & RC_DEPTH_BUFFER_BIT   ? gl.DEPTH_BUFFER_BIT   : 0) |
                 (mask & RC_STENCIL_BUFFER_BIT ? gl.STENCIL_BUFFER_BIT : 0));
    }

    this.clearColor = function(r, g, b, a)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.ClearColor, [r, g, b, a]);
        
        gl.clearColor(r, g, b, a);
    }
    
    this.clearDepth = function(d)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.ClearDepth, [d]);
        
        gl.clearDepth(d);
    }
    
    this.clearStencil = function(s)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.ClearStencil, [s]);
        
        gl.clearStencil(s);  
    }
    
    this.createVertexBuffer = function(numVerticesPerPrimitive)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.CreateVertexBuffer, [numVerticesPerPrimitive]);
        
        return new webglVB(this, gl, program, numVerticesPerPrimitive);
    }
    
    this.createTextureObject = function()
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.CreateTextureObject, null);
        
        return new webglTO(this, gl, program);
    }

    this.disable = function(cap)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.Disable, [cap]);
        
        switch (cap)
        {
            case eRenderMode.AlphaBlend:
                gl.disable(gl.BLEND);
                break;

            case eRenderMode.CullBackFace:
                gl.disable(gl.CULL_FACE);
                break;

            case eRenderMode.DepthBufferWrite:
                gl.depthMask(false);
                break;

            case eRenderMode.DepthTest:
                gl.disable(gl.DEPTH_TEST);
                break;

            case eRenderMode.Lighting:
                gl.uniform1i(program.lightingEnabled, false); 
                break;
                
            case eRenderMode.StencilTest:
                gl.disable(gl.STENCIL_TEST);
                break;
        }
    }

    this.enable = function(cap)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.Enable, [cap]);
        
        switch (cap)
        {
            case eRenderMode.AlphaBlend:
                gl.enable(gl.BLEND);
                break;

            case eRenderMode.CullBackFace:
                gl.enable(gl.CULL_FACE);
                break;

            case eRenderMode.DepthBufferWrite:
                gl.depthMask(true);
                break;

            case eRenderMode.DepthTest:
                gl.enable(gl.DEPTH_TEST);
                break;

            case eRenderMode.Lighting:
                gl.uniform1i(program.lightingEnabled, true);
                break;
                
            case eRenderMode.StencilTest:
                gl.enable(gl.STENCIL_TEST);
                break;
        }
    }

    this.enabled = function(cap)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.Enabled, [cap]);
        
        var e = false;

        switch (cap)
        {
            case eRenderMode.AlphaBlend:
                e = gl.getParameter(gl.BLEND);
                break;

            case eRenderMode.CullBackFace:
                e = gl.getParameter(gl.CULL_FACE);
                break;
                
            case eRenderMode.DepthBufferWrite:
                e = gl.getParameter(gl.DEPTH_WRITEMASK);
                break;

            case eRenderMode.DepthTest:
                e = gl.getParameter(gl.DEPTH_TEST);
                break;

            case eRenderMode.Lighting:
                e = gl.getUniform(program, program.lightingEnabled);
                break;
                
            case eRenderMode.StencilTest:
                e = gl.getParameter(gl.STENCIL_TEST);
                break;
        }

        return e;
    }

    this.enableLight = function(index, enable)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.EnableLight, [index, enable]);
        
        gl.uniform1i(program.lightSource[index].enabled, enable);

        vLightEnabledStates[index] = enable;
    }
    
    this.enableTextureStage = function(stage, enable)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.EnableTextureStage, [stage, enable]);
        
        gl.uniform1i(program.textureStageEnabled[stage], enable);
    }
    
    this.finish = function()
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.Finish, null);
        
        gl.finish();
    }

    this.getEnabledLights = function()
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.GetEnabledLights, null);
        
        var indices = [];

        for (var i = 0; i < vLightEnabledStates.length; i++)
        {
            if (vLightEnabledStates[i])
            {
                indices.push(i);
            }
        }

        return indices;
    }

    this.getGlobalIllumination = function()
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.GetGlobalIllumination, null);
        
        var values = gl.getUniform(program, program.globalAmbientLight);

        return { r: values[0], g: values[1], b: values[2], a: values[3] };
    }
    
    this.getLight = function(index)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.GetLight, [index]);
        
        return { desc: vLightDescs[index], matrix: vLightMatrices[index] };
    }
    
    this.getMaxLightCount = function()
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.GetMaxLightCount, null);
        
        return gl_MaxLights;
    }
    
    this.getMaxTextureStages = function()
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.GetMaxTextureStages, null);
        
        return gl_MaxTextureStages;
    }
    
    this.perspectiveMatrixLH = function(left, right, top, bottom, near, far)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.PerspectiveMatrixLH, [left, right, top, bottom, near, far]);
        
        var p = new Matrix4x4();
        
        var a = (right + left) / (right - left);
        var b = (top + bottom) / (top - bottom);
        var c = (far + near) / (far - near);
        var d = (2 * far * near) / (far - near);
        
        p._11 = (2 * near) / (right - left);
        p._13 = a;
        p._22 = (2 * near) / (top - bottom);
        p._23 = b;
        p._33 = c;
        p._34 = 1;
        p._43 = -d;
        p._44 = 0;
        
        return p;
    }
    
    this.orthographicMatrixLH = function(left, right, top, bottom, near, far)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.OrthographicMatrixLH, [left, right, top, bottom, near, far]);
        
        var p = new Matrix4x4();
        
        p._11 =  2 / (right - left);
        p._22 =  2 / (top - bottom);
        p._33 = -2 / (far - near);
        p._41 = -((right + left) / (right - left));
        p._42 = -((top + bottom) / (top - bottom));
        p._43 = -((far + near) / (far - near)) / 2;
              
        return p;
    }
    
    this.readFrameBuffer = function(x, y, width, height)
    {
        var pixels = new Uint8Array(width * height * 4);
        
        gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        
        return pixels;
    }
    
    this.setBlendFactor = function(sfactor, dfactor)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.SetBlendFactor, [sfactor, dfactor]);
        
        var gl_SrcFactor;
        switch (sfactor)
        {
        case RC_ZERO:                   gl_SrcFactor = gl.ZERO; break;
        case RC_ONE:                    gl_SrcFactor = gl.ONE; break;
        case RC_SRC_COLOR:              gl_SrcFactor = gl.SRC_COLOR; break;
        case RC_SRC_ALPHA:              gl_SrcFactor = gl.SRC_ALPHA; break;        
        case RC_ONE_MINUS_SRC_COLOR:    gl_SrcFactor = gl.ONE_MINUS_SRC_COLOR; break;
        case RC_ONE_MINUS_SRC_ALPHA:    gl_SrcFactor = gl.ONE_MINUS_SRC_ALPHA; break;
        case RC_DEST_COLOR:             gl_SrcFactor = gl.DEST_COLOR; break;
        case RC_DEST_ALPHA:             gl_SrcFactor = gl.DEST_ALPHA; break;        
        case RC_ONE_MINUS_DEST_COLOR:   gl_SrcFactor = gl.ONE_MINUS_DEST_COLOR; break;
        case RC_ONE_MINUS_DEST_ALPHA:   gl_SrcFactor = gl.ONE_MINUS_DEST_ALPHA; break;
        }     
        
        var gl_DestFactor;
        switch (dfactor)
        {
        case RC_ZERO:                   gl_DestFactor = gl.ZERO; break;
        case RC_ONE:                    gl_DestFactor = gl.ONE; break;
        case RC_SRC_COLOR:              gl_DestFactor = gl.SRC_COLOR; break;
        case RC_SRC_ALPHA:              gl_DestFactor = gl.SRC_ALPHA; break;        
        case RC_ONE_MINUS_SRC_COLOR:    gl_DestFactor = gl.ONE_MINUS_SRC_COLOR; break;
        case RC_ONE_MINUS_SRC_ALPHA:    gl_DestFactor = gl.ONE_MINUS_SRC_ALPHA; break;
        case RC_DEST_COLOR:             gl_DestFactor = gl.DEST_COLOR; break;
        case RC_DEST_ALPHA:             gl_DestFactor = gl.DEST_ALPHA; break;        
        case RC_ONE_MINUS_DEST_COLOR:   gl_DestFactor = gl.ONE_MINUS_DEST_COLOR; break;
        case RC_ONE_MINUS_DEST_ALPHA:   gl_DestFactor = gl.ONE_MINUS_DEST_ALPHA; break;
        }
        
        gl.blendFunc(gl_SrcFactor, gl_DestFactor);  
    }

    this.setDepthFunc = function(func)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.SetDepthFunc, [func]);
        
        var gl_DepthFunc;
        switch (func)
        {
        case eDepthFunc.Never:          gl_DepthFunc = gl.NEVER; break;
        case eDepthFunc.Less:           gl_DepthFunc = gl.LESS; break;
        case eDepthFunc.LessEqual:      gl_DepthFunc = gl.LEQUAL; break;
        case eDepthFunc.Equal:          gl_DepthFunc = gl.EQUAL; break;
        case eDepthFunc.NotEqual:       gl_DepthFunc = gl.NOTEQUAL; break;
        case eDepthFunc.GreaterEqual:   gl_DepthFunc = gl.GEQUAL; break;
        case eDepthFunc.Greater:        gl_DepthFunc = gl.GREATER; break;
        case eDepthFunc.Always:         gl_DepthFunc = gl.ALWAYS; break;
        }
        
        gl.depthFunc(gl_DepthFunc);
           
    }
    
    this.setEnabledLights = function(indices)
    {
        if (this.displayListObj) if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.SetEnabledLights, [indices]);
        
        // disable all previously enabled lights
        for (var i = 0; i < vLightEnabledStates.length; i++)
        {
            if (vLightEnabledStates[i])
            {
                this.enableLight(i, false);
            }
        }

        // enable specified lights
        for (var i = 0; i < indices.length; i++)
        {
            this.enableLight(indices[i], true);
        }
    }
    
    this.setFrontMaterial = function(desc)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.SetFrontMaterial, [desc]);
        
        // ambient
        if (desc.validMembersMask & MATERIALDESC_AMBIENT_BIT)
        {
            gl.uniform4fv(program.frontMaterial.ambient, new Float32Array(desc.ambient.v()));
            
            this.frontMaterial.ambient = desc.ambient;
        }
        
        // diffuse
        if (desc.validMembersMask & MATERIALDESC_DIFFUSE_BIT)
        {
            gl.uniform4fv(program.frontMaterial.diffuse, new Float32Array(desc.diffuse.v()));
            
            this.frontMaterial.diffuse = desc.diffuse;
        }
        
        // specular
        if (desc.validMembersMask & MATERIALDESC_SPECULAR_BIT)
        {
            gl.uniform4fv(program.frontMaterial.specular, new Float32Array(desc.specular.v()));
            
            this.frontMaterial.specular = desc.specular;
        }
        
        // emissive
        if (desc.validMembersMask & MATERIALDESC_EMISSIVE_BIT)
        {
            // TODO
            //gl.uniform4fv(program.frontMaterial.emission, new Float32Array(desc.emissive.v()));
            
            this.frontMaterial.emissive = desc.emissive;
        }
        
        // glossiness
        if (desc.validMembersMask & MATERIALDESC_GLOSSINESS_BIT)
        {
            // glossiness - OpenGL accepts values in the range [0, 128].
            // use the range [5, 128], because values below 5 result in wash-out
            gl.uniform1f(program.frontMaterial.shininess, clamp(desc.glossiness * 128, 5, 128));
            
            this.frontMaterial.glossiness = desc.glossiness;
        }
        
        this.frontMaterial.validMembersMask |= desc.validMembersMask;
    }

    this.setGlobalIllumination = function(ambient)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.SetGlobalIllumination, [ambient]);
        
        var values = [ ambient.r, ambient.g, ambient.g, ambient.a ];

        gl.uniform4fv(program.globalAmbientLight, new Float32Array(values));
    }

    this.setLight = function(index, desc)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.SetLight, [index, desc]);
        
        // get current modelView transform
        var modelViewMatrix = this.modelViewMatrixStack.top();

        // position
        if (desc.validMembersMask & LIGHTDESC_POSITION_BIT)
        {
            // transform to view space
            var position = modelViewMatrix.transformw(desc.position.x, desc.position.y, desc.position.z, 1);
            var values = [position.x, position.y, position.z, position.w];
            gl.uniform4fv(program.lightSource[index].position, new Float32Array(values));
        }

        // direction
        if (desc.validMembersMask & LIGHTDESC_DIRECTION_BIT)
        {
            // transform to view space
            var direction = modelViewMatrix.transform(desc.direction.x, desc.direction.y, desc.direction.z, 0);
            var values = [direction.x, direction.y, direction.z, 0];

            switch (desc.type)
            {
                case "directional":
                    {
                        values[0] *= -1;
                        values[1] *= -1;
                        values[2] *= -1;

                        // OpenGL gets a directional light's direction from position member                
                        gl.uniform4fv(program.lightSource[index].position, new Float32Array(values));
                    }
                    break;

                case "spot":
                    {
                        gl.uniform4fv(program.lightSource[index].spotDirection, new Float32Array(values));
                    }
                    break;
            }
        }

        // ambient
        if (desc.validMembersMask & LIGHTDESC_AMBIENT_BIT)
        {
            gl.uniform4fv(program.lightSource[index].ambient, new Float32Array(desc.ambient.v()));
        }

        // diffuse
        if (desc.validMembersMask & LIGHTDESC_DIFFUSE_BIT)
        {
            gl.uniform4fv(program.lightSource[index].diffuse, new Float32Array(desc.diffuse.v()));
        }

        // specular
        if (desc.validMembersMask & LIGHTDESC_SPECULAR_BIT)
        {
            gl.uniform4fv(program.lightSource[index].specular, new Float32Array(desc.specular.v()));
        }

        // constant attenuation
        if (desc.validMembersMask & LIGHTDESC_CONSTANT_ATT_BIT)
        {
            gl.uniform1f(program.lightSource[index].constantAttenuation, desc.constantAttenuation);
        }

        // linear attenuation
        if (desc.validMembersMask & LIGHTDESC_LINEAR_ATT_BIT)
        {
            gl.uniform1f(program.lightSource[index].linearAttenuation, desc.linearAttenuation);
        }

        // quadratic attenuation
        if (desc.validMembersMask & LIGHTDESC_QUADRATIC_ATT_BIT)
        {
            gl.uniform1f(program.lightSource[index].quadraticAttenuation, desc.quadraticAttenuation);
        }

        // range
        if (desc.validMembersMask & LIGHTDESC_RANGE_BIT)
        {
            // TODO
            //gl.uniform1f(program.lightSource[index].range, desc.range);
        }

        // outer cone angle
        if (desc.validMembersMask & LIGHTDESC_OUTER_CONE_DEG_BIT)
        {
            var outerConeDegrees = desc.outerConeDegrees;

            // OpenGL accepts cone degrees in the range [0, 90] or 180
            if (outerConeDegrees > 90)
            {
                outerConeDegrees = 180;
            }

            gl.uniform1f(program.lightSource[index].spotCutoff, outerConeDegrees);

            gl.uniform1f(program.lightSource[index].spotExponent, 0);
        }

        // inner cone angle
        if (desc.validMembersMask & LIGHTDESC_INNER_CONE_DEG_BIT)
        {
            // TODO
        }

        // cone falloff
        if (desc.validMembersMask & LIGHTDESC_CONE_FALLOFF_BIT)
        {
            // TODO
        }

        vLightDescs[index] = desc;
        vLightMatrices[index] = modelViewMatrix;
    }

    this.setShadeModel = function(model)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.SetShadeModel, [model]);
        
        // TODO
    }
    
    this.setStencilFunc = function(func, ref, mask)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.SetStencilFunc, [func, ref, mask]);
        
        var gl_StencilFunc;
        switch (func)
        {
        case eDepthFunc.Never:          gl_StencilFunc = gl.NEVER; break;
        case eDepthFunc.Less:           gl_StencilFunc = gl.LESS; break;
        case eDepthFunc.LessEqual:      gl_StencilFunc = gl.LEQUAL; break;
        case eDepthFunc.Equal:          gl_StencilFunc = gl.EQUAL; break;
        case eDepthFunc.NotEqual:       gl_StencilFunc = gl.NOTEQUAL; break;
        case eDepthFunc.GreaterEqual:   gl_StencilFunc = gl.GEQUAL; break;
        case eDepthFunc.Greater:        gl_StencilFunc = gl.GREATER; break;
        case eDepthFunc.Always:         gl_StencilFunc = gl.ALWAYS; break;
        }
        
        gl.stencilFunc(gl_StencilFunc, ref, mask);
    }
            
    this.setStencilMask = function(mask)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.SetStencilMask, [mask]);
        
        gl.stencilMask(mask);
    } 
    
    this.setStencilOp = function(fail, zFail, zPass)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.SetStencilOp, [fail, zFail, zPass]);
       
        var gl_Fail;
        switch (fail)
        {
        case eStencilOp.Keep:           gl_Fail = gl.KEEP; break;
        case eStencilOp.Replace:        gl_Fail = gl.REPLACE; break;
        case eStencilOp.Increment:      gl_Fail = gl.INCR; break;
        case eStencilOp.Decrement:      gl_Fail = gl.DECR; break;
        case eStencilOp.Invert:         gl_Fail = gl.INVERT; break;
        case eStencilOp.Zero:           gl_Fail = gl.ZERO; break;
        }
        
        switch (zFail)
        {
        case eStencilOp.Keep:           gl_ZFail = gl.KEEP; break;
        case eStencilOp.Replace:        gl_ZFail = gl.REPLACE; break;
        case eStencilOp.Increment:      gl_ZFail = gl.INCR; break;
        case eStencilOp.Decrement:      gl_ZFail = gl.DECR; break;
        case eStencilOp.Invert:         gl_ZFail = gl.INVERT; break;
        case eStencilOp.Zero:           gl_ZFail = gl.ZERO; break;
        }
        
        switch (zPass)
        {
        case eStencilOp.Keep:           gl_ZPass = gl.KEEP; break;
        case eStencilOp.Replace:        gl_ZPass = gl.REPLACE; break;
        case eStencilOp.Increment:      gl_ZPass = gl.INCR; break;
        case eStencilOp.Decrement:      gl_ZPass = gl.DECR; break;
        case eStencilOp.Invert:         gl_ZPass = gl.INVERT; break;
        case eStencilOp.Zero:           gl_ZPass = gl.ZERO; break;
        }
        
        gl.stencilOp(gl_Fail, gl_ZFail, gl_ZPass);
    }
    
    this.setTextureBlendFactor = function(factor)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.SetTextureBlendFactor, [factor]);
        
        // update material diffuse component alpha to blend factor
        var diffuse = [ this.frontMaterial.diffuse.r, this.frontMaterial.diffuse.g, this.frontMaterial.diffuse.b, factor ];
        gl.uniform4fv(program.frontMaterial.diffuse, new Float32Array(diffuse));
    }
    
    this.setTextureBlendOp = function(op)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.SetTextureBlendOp, [op]);
        
        gl.uniform1i(program.textureBlendOp, op);
    }

    this.setViewport = function(x, y, width, height)
    {
        if (this.displayListObj) DL_ADD_METHOD_DESC(this.displayListObj, eRenderContextMethod.SetViewport, [x, y, width, height]);
        
        gl.viewport(x, y, width, height);
    }
}

function getWebGLContext(canvas, debug) 
{
    var gl = null;
    try 
    {
        if (debug)
        {
            gl = WebGLDebugUtils.makeDebugContext(canvas.getContext("experimental-webgl", { stencil: true, antialias: false, preserveDrawingBuffer: true }));
        }
        else // !debug
        {
            gl = (canvas.getContext("webgl", { stencil: true, antialias: true, preserveDrawingBuffer: true }) || 
                  canvas.getContext("experimental-webgl", { stencil: true, antialias: true, preserveDrawingBuffer: true }));
        }
    }    
    catch (e) 
    {
    }
    if (!gl) 
    {
        var div = document.createElement("div");
        div.innerHTML = "This demo requires a WebGL-enabled browser.";
        var canvasParent = canvas.parentNode;
        canvasParent.replaceChild(div, canvas);
    }

    var stencilBits = gl.getParameter(gl.STENCIL_BITS);

    return gl;
}

function getProgram(gl, vShader, fShader)
{
    var program = gl.createProgram();
    if (!program) return null;
    
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    {
        alert(gl.getProgramInfoLog(program));
        return null;
    }
    
    gl.useProgram(program);
    
    // get attributes
    program.vertexPositionAttribute = gl.getAttribLocation(program, "aVertexPosition");
    gl.enableVertexAttribArray(program.vertexPositionAttribute);
    program.vertexNormalAttribute = gl.getAttribLocation(program, "aVertexNormal");
    gl.enableVertexAttribArray(program.vertexNormalAttribute);
    program.vertexColorAttribute = gl.getAttribLocation(program, "aVertexColor");
    gl.enableVertexAttribArray(program.vertexColorAttribute);
    program.textureCoordAttribute = new Array(gl_MaxTextureStages);
    for (var i=0; i < gl_MaxTextureStages; i++)
    {
        program.textureCoordAttribute[i] = gl.getAttribLocation(program, "aTextureCoord" + i);
        gl.enableVertexAttribArray(program.textureCoordAttribute[i]);
    }
    
    // get uniforms
    
    // matrices
    program.projectionMatrix = gl.getUniformLocation(program, "uProjectionMatrix");
    program.modelViewMatrix = gl.getUniformLocation(program, "uModelViewMatrix");
    program.normalMatrix = gl.getUniformLocation(program, "uNormalMatrix");

    // lights
    program.globalAmbientLight = gl.getUniformLocation(program, "uGlobalAmbientLight");
    program.lightSource = new Array(gl_MaxLights);
    for (var i=0; i < gl_MaxLights; i++)
    {
        program.lightSource[i] = new gl_LightSourceParameters();
      
        program.lightSource[i].enabled = gl.getUniformLocation(program, "uLightSource_enabled[" + i + "]");
        program.lightSource[i].ambient = gl.getUniformLocation(program, "uLightSource_ambient[" + i + "]"); 
        program.lightSource[i].diffuse = gl.getUniformLocation(program, "uLightSource_diffuse[" + i + "]");
        program.lightSource[i].specular = gl.getUniformLocation(program, "uLightSource_specular[" + i + "]");
        program.lightSource[i].position = gl.getUniformLocation(program, "uLightSource_position[" + i + "]");
        program.lightSource[i].spotDirection = gl.getUniformLocation(program, "uLightSource_spotDirection[" + i + "]");
        program.lightSource[i].spotExponent = gl.getUniformLocation(program, "uLightSource_spotExponent[" + i + "]");
        program.lightSource[i].spotCutoff = gl.getUniformLocation(program, "uLightSource_spotCutoff[" + i + "]");
        program.lightSource[i].constantAttenuation = gl.getUniformLocation(program, "uLightSource_constantAttenuation[" + i + "]");
        program.lightSource[i].linearAttenuation = gl.getUniformLocation(program, "uLightSource_linearAttenuation[" + i + "]");
        program.lightSource[i].quadraticAttenuation = gl.getUniformLocation(program, "uLightSource_quadraticAttenuation[" + i + "]");
        
        // set initially disabled
        gl.uniform1i(program.lightSource[i].enabled, 0);
    }
    
    // materials
    program.frontMaterial = new gl_MaterialParameters();
    program.frontMaterial.ambient = gl.getUniformLocation(program, "uFrontMaterial_ambient");
    program.frontMaterial.diffuse = gl.getUniformLocation(program, "uFrontMaterial_diffuse");
    program.frontMaterial.specular = gl.getUniformLocation(program, "uFrontMaterial_specular");
    program.frontMaterial.emission = gl.getUniformLocation(program, "uFrontMaterial_emission");
    program.frontMaterial.shininess = gl.getUniformLocation(program, "uFrontMaterial_shininess");
     
    // textures
    program.textureSamplerColor = new Array(gl_MaxTextureStages);
    program.textureSamplerAlpha = new Array(gl_MaxTextureStages);
    program.textureStageEnabled = new Array(gl_MaxTextureStages)
    for (var i=0; i < gl_MaxTextureStages; i++)
    {
        program.textureSamplerColor[i] = gl.getUniformLocation(program, "uTextureSamplerColor[" + i + "]");
        program.textureSamplerAlpha[i] = gl.getUniformLocation(program, "uTextureSamplerAlpha[" + i + "]");
        program.textureStageEnabled[i] = gl.getUniformLocation(program, "uTextureStageEnabled[" + i + "]");
    }
    program.textureBlendOp = gl.getUniformLocation(program, "uTextureBlendOp");
    
    // enabled
    program.lightingEnabled = gl.getUniformLocation(program, "uLightingEnabled");
    program.texturesEnabled = gl.getUniformLocation(program, "uTexturesEnabled");
    
    // set initially enabled/disabled
    gl.uniform1i(program.lightingEnabled, 1);
    gl.uniform1i(program.texturesEnabled, 1); 
    gl.uniform1i(program.textureStageEnabled[0], 0); 
    gl.uniform1i(program.textureStageEnabled[1], 0);
    
    return program;
}
