"use strict";

var gl; // webgl context
var canvas;

var prog_Box; // skybox program
var skybox;// skybox object

var prog; // orbuculum program
var orbuculum; // orbuculum object

var prog_shadow;
var prog_shadow_gen;

var progSmoke; // smoke program
var smokeParticles = []; // smokes
var numParticles = 150;
var delta = 0.005; //rotation delta

var rotator; // rotator object

var projection = mat4.create();
var modelview = mat4.create();
var normalMV = mat3.create();
var invMV = mat3.create();

var oldmodelview = mat4.create();
var lightPosition = vec3.fromValues(10,15,25);

var shadowMapFrameBuffer,shadowMapCube,shadowMapRenderBuffer;
var floatExtension, floatLinearExtension;
var textureSize = 512;

var shadowMapCamProj = mat4.create();
var shadowMapCamView = [
            mat4.create(), //pos x
            mat4.create(), //neg x
            mat4.create(), //pos y
            mat4.create(), //neg y
            mat4.create(), //pos z
            mat4.create()  //neg z
];
var shadowClipNearFar = vec2.fromValues(0.1,130.0);
var toggle = false;

var textures = {};

var lasttime;

var startBlur = false;
var maxSigma = 2.0, minSigma = 0.3;
var sigma = minSigma;
var change = minSigma - maxSigma;
var duration = 800;  // duration controls the total blur elapse time!
var start;
function easingfunc(t, b, c, d) {
    return c*(t/=d)*t + b;
}
function animate(now) {
    if (startBlur) {
        start = now;
        sigma = maxSigma;
        startBlur = false;
    }
    if (sigma > minSigma) {
        var t = now - start;
        sigma = easingfunc(t, maxSigma, change, duration);
    }
    draw();
    requestAnimationFrame(animate);
}

function evolveSmoke() {
    var now = new Date();
    var delta_time = lasttime - now;
    lasttime = now;
    smokeParticles.map((particle) => {
        quat.rotateZ(particle.randQ,particle.randQ,delta_time * delta * Math.random() * 0.1);
    })
}

function draw() {
    gl.clearColor(0,0,0,1);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mat4.perspective(projection, Math.PI/3, canvas.width/canvas.height, 10, 2000);

    modelview = rotator.getViewMatrix();
    mat3.normalFromMat4(normalMV, modelview);
    mat3.fromMat4(invMV, modelview);
    mat3.invert(invMV, invMV);

    // draw skybox
    if (textures.skyboxTex&&toggle) {
        gl.useProgram(prog_Box);
        gl.uniform3fv(gl.getUniformLocation(prog_Box,"lightPosition"),lightPosition);
        gl.uniform1i(gl.getUniformLocation(prog_Box,"skybox"), 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, textures.skyboxTex);
        gl.enableVertexAttribArray(skybox.coords_loc);
        gl.enableVertexAttribArray(skybox.normal_loc);
        skybox.render(projection,oldmodelview);
        gl.disableVertexAttribArray(skybox.coords_loc);
        gl.disableVertexAttribArray(skybox.normal_loc);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    }

    if (textures.skyboxTex&&!toggle) {
        gl.useProgram(prog_shadow);
        gl.uniform3fv(gl.getUniformLocation(prog_shadow,"lightPosition"),lightPosition);
        gl.uniform2fv(gl.getUniformLocation(prog_shadow,"shadowClipNearFar"),shadowClipNearFar);
        gl.uniform1i(gl.getUniformLocation(prog_shadow,"skybox"), 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, textures.skyboxTex);
        gl.uniform1i(gl.getUniformLocation(prog_shadow,"lightShadowMap"), 1);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, shadowMapCube);
        gl.enableVertexAttribArray(skybox.coords_loc);
        gl.enableVertexAttribArray(skybox.normal_loc);
        skybox.render(projection,oldmodelview);
        gl.disableVertexAttribArray(skybox.coords_loc);
        gl.disableVertexAttribArray(skybox.normal_loc);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    }

    // draw orbuculum
    if (textures.orbuculumTex && orbuculum) {
        gl.useProgram(prog);
        gl.uniform3fv(gl.getUniformLocation(prog,"lightPosition"),lightPosition);
        gl.uniform1f(gl.getUniformLocation(prog,"shininess"),50);
        gl.uniform1f(gl.getUniformLocation(prog,"sigma"),sigma);
        gl.uniform1i(gl.getUniformLocation(prog,"skybox"), 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, textures.orbuculumTex);
        gl.enableVertexAttribArray(orbuculum.coords_loc);
        gl.enableVertexAttribArray(orbuculum.normal_loc);
        orbuculum.render(projection, modelview, normalMV, invMV);
        gl.disableVertexAttribArray(orbuculum.coords_loc);
        gl.disableVertexAttribArray(orbuculum.normal_loc);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    }

      // draw smokes
    if (textures.smokeTex && smokeParticles.length > 0) {
        evolveSmoke();
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(progSmoke);
        gl.bindTexture(gl.TEXTURE_2D, textures.smokeTex);
        for (let p = 0; p < smokeParticles.length; p++) {
            gl.enableVertexAttribArray(smokeParticles[p].coords_loc);
            gl.enableVertexAttribArray(smokeParticles[p].texcoords_loc);
            mat4.fromRotationTranslationScale(smokeParticles[p].modelTransform, smokeParticles[p].randQ, smokeParticles[p].randV, smokeParticles[p].randS);
            smokeParticles[p].render(projection, oldmodelview, smokeParticles[p].modelTransform);
            gl.disableVertexAttribArray(smokeParticles[p].coords_loc);
            gl.disableVertexAttribArray(smokeParticles[p].texcoords_loc);
        }
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
    }

}


function loadTexture(texID, urls) {
    Promise.all(urls.map((url, idx) => {
        return new Promise(resolve => {
            let img = new Image();
            img.crossOrigin = '';
            img.onload = function() {
                resolve(img);
            }
            img.src = url;
        });
    })).then(imgs => {
        textures[texID] = gl.createTexture();
        if (texID != 'smokeTex') {
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, textures[texID]);
            var targets = [
            gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
            ];
            for (let j = 0; j < 6; j++) {
                gl.texImage2D(targets[j], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgs[j]);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            }
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, textures[texID]);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
            // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,new Uint8Array([0, 0, 255, 255]));
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgs[0]);
            gl.generateMipmap(gl.TEXTURE_2D);
        }
        // draw();
        startBlur = true;
    });
}

//the code of this function is revised from https://github.com/sessamekesh/IndigoCS-webgl-tutorials/blob/master/Shadow%20Mapping/LightMapDemoScene.js
function initframebuffer(){
    shadowMapCube = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP,shadowMapCube);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    floatExtension = gl.getExtension("OES_texture_float");
    floatLinearExtension = gl.getExtension("OES_texture_float_linear");
    if (floatExtension && floatLinearExtension) {
        for (var i = 0; i < 6; i++) {
            gl.texImage2D(
                gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                0, gl.RGBA,
                textureSize, textureSize,
                0, gl.RGBA,
                gl.FLOAT, null
            );
        }
    } else {
        for (var i = 0; i < 6; i++) {
            gl.texImage2D(
                gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                0, gl.RGBA,
                textureSize, textureSize,
                0, gl.RGBA,
                gl.UNSIGNED_BYTE, null
            );
        }
    }
    shadowMapFrameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowMapFrameBuffer);

    shadowMapRenderBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, shadowMapRenderBuffer);
    gl.renderbufferStorage(
        gl.RENDERBUFFER, gl.DEPTH_COMPONENT16,
        textureSize, textureSize
    );

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}


//the code of this function is revised from https://github.com/sessamekesh/IndigoCS-webgl-tutorials/blob/master/Shadow%20Mapping/LightMapDemoScene.js
function createCamMatrix(){
    mat4.perspective(shadowMapCamProj,glMatrix.toRadian(90),1.0,shadowClipNearFar[0],shadowClipNearFar[1] );
    mat4.lookAt(shadowMapCamView[0],lightPosition,vec3.add(vec3.create(), lightPosition, vec3.fromValues(1, 0, 0)), vec3.fromValues(0, -1.0, 0));
    mat4.lookAt(shadowMapCamView[1],lightPosition,vec3.add(vec3.create(), lightPosition, vec3.fromValues(-1, 0, 0)), vec3.fromValues(0, -1.0, 0));
    mat4.lookAt(shadowMapCamView[2],lightPosition,vec3.add(vec3.create(), lightPosition, vec3.fromValues(0, 1, 0)), vec3.fromValues(0, 0, 1.0));
    mat4.lookAt(shadowMapCamView[3],lightPosition,vec3.add(vec3.create(), lightPosition, vec3.fromValues(0, -1, 0)), vec3.fromValues(0, 0, -1.0));
    mat4.lookAt(shadowMapCamView[4],lightPosition,vec3.add(vec3.create(), lightPosition, vec3.fromValues(0, 0, 1)), vec3.fromValues(0, -1.0, 0));
    mat4.lookAt(shadowMapCamView[5],lightPosition,vec3.add(vec3.create(), lightPosition, vec3.fromValues(0, 0, -1)), vec3.fromValues(0, -1.0, 0));
}
//the code of this function is revised from https://github.com/sessamekesh/IndigoCS-webgl-tutorials/blob/master/Shadow%20Mapping/LightMapDemoScene.js
function generateShadowMap(){
    gl.useProgram(prog_shadow_gen);

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, shadowMapCube);
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowMapFrameBuffer);
    gl.bindRenderbuffer(gl.RENDERBUFFER, shadowMapRenderBuffer);

     gl.viewport(0, 0, textureSize, textureSize);
    gl.enable(gl.DEPTH_TEST);
    //gl.enable(gl.CULL_FACE);

    gl.uniform2fv(gl.getUniformLocation(prog_shadow_gen,"shadowClipNearFar"),shadowClipNearFar);
     gl.uniform3fv(gl.getUniformLocation(prog_shadow_gen,"lightPosition"),lightPosition);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog_shadow_gen,"projection"),gl.FALSE,shadowMapCamProj);

    for (var i = 0; i < shadowMapCamView.length; i++) {
        // Set per light uniforms
        gl.uniformMatrix4fv(
            gl.getUniformLocation(prog_shadow_gen,"modelview"),
            gl.FALSE,
            shadowMapCamView[i]
        );

        // Set framebuffer destination
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
            shadowMapCube,
            0
        );
        gl.framebufferRenderbuffer(
            gl.FRAMEBUFFER,
            gl.DEPTH_ATTACHMENT,
            gl.RENDERBUFFER,
            shadowMapRenderBuffer
        );

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.bindBuffer(gl.ARRAY_BUFFER, skybox.coordsBuffer);
        gl.vertexAttribPointer(gl.getAttribLocation(prog_shadow_gen,"coords"), 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(gl.getAttribLocation(prog_shadow_gen,"coords"));
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skybox.indexBuffer);
        gl.drawElements( gl.TRIANGLES, skybox.count, gl.UNSIGNED_SHORT, 0 );
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.disableVertexAttribArray(gl.getAttribLocation(prog_shadow_gen,"coords"));

        gl.bindBuffer(gl.ARRAY_BUFFER, orbuculum.coordsBuffer);
        gl.vertexAttribPointer(gl.getAttribLocation(prog_shadow_gen,"coords"), 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(gl.getAttribLocation(prog_shadow_gen,"coords"));
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, orbuculum.indexBuffer);
        gl.drawElements( gl.TRIANGLES, orbuculum.count, gl.UNSIGNED_SHORT, 0 );
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.disableVertexAttribArray(gl.getAttribLocation(prog_shadow_gen,"coords"));

    }
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

}

function init() {
    try {
        canvas = document.getElementById("glcanvas");
        // canvas.width  = window.innerWidth;
        // canvas.height = window.innerHeight * 0.7;
        gl = canvas.getContext("webgl");
        if (!gl) {
            gl = canvas.getContext("experimental-webgl");
        }
        if (!gl) {
            throw "Could not create WebGL context.";
        }
        // gl = WebGLDebugUtils.makeDebugContext(gl, undefined, logAndValidate);
        var vshaderSource = getTextContent("vshaderBox");
        var fshaderSource = getTextContent("fshaderBox");
        prog_Box = createProgram(gl, vshaderSource, fshaderSource);

        vshaderSource = getTextContent("vshader");
        fshaderSource = getTextContent("fshader");
        prog = createProgram(gl, vshaderSource, fshaderSource);

        vshaderSource = getTextContent("vGshader");
        fshaderSource = getTextContent("fGshader");
        progSmoke = createProgram(gl, vshaderSource, fshaderSource);

        vshaderSource = getTextContent("vshaderBoxShadow");
        fshaderSource = getTextContent("fshaderBoxShadow");
        prog_shadow = createProgram(gl, vshaderSource, fshaderSource);

        vshaderSource = getTextContent("vshaderBoxShadowGen");
        fshaderSource = getTextContent("fshaderBoxShadowGen");
        prog_shadow_gen = createProgram(gl, vshaderSource, fshaderSource);

        gl.enable(gl.DEPTH_TEST);

        initframebuffer();
        createCamMatrix();

        rotator = new SimpleRotator(canvas, draw);
        rotator.setView([0,0,1], [0,1,0], 20);

        oldmodelview = rotator.getViewMatrix();


        skybox = new Cube(50);
        orbuculum = new Sphere(7);

        if(toggle)skybox.link(gl, prog_Box);
        else skybox.link(gl, prog_shadow);
        skybox.upload(gl);
        orbuculum.link(gl, prog);
        orbuculum.upload(gl);

        generateShadowMap();

        for (let p = 0; p < Math.floor(numParticles / 2); p++) {
            var particle = new Square(30, [0.1, 0.4, 0.8, 1.0]);
            particle.randQ = quat.fromValues(0, 0, 1, Math.random() - 1);
            quat.normalize(particle.randQ, particle.randQ);
            particle.randV = vec3.fromValues(40*(Math.random()-1) + 40, 30*(Math.random()-1) - 10, 20*(Math.random()-1));
            particle.randS = vec3.fromValues(1, 1, 1);
            particle.modelTransform = mat4.create();
            particle.link(gl, progSmoke)
            particle.upload(gl);
            smokeParticles.push(particle);
        }

        for (let p = 0; p < Math.floor(numParticles); p++) {
            var particle = new Square(30, [0.1, 0.4, 0.8, 1.0]);
            particle.randQ = quat.fromValues(0, 0, 1, Math.random() - 1);
            quat.normalize(particle.randQ, particle.randQ);
            particle.randV = vec3.fromValues(40*(Math.random()-1), 30*(Math.random()-1) - 10, 20*(Math.random()-1));
            particle.randS = vec3.fromValues(1, 1, 1);
            particle.modelTransform = mat4.create();
            particle.link(gl, progSmoke)
            particle.upload(gl);
            smokeParticles.push(particle);
        }


    }
    catch(e) {
        document.getElementById("message").innerHTML = e;
        return;
    }
}

// main function
init();
initMap();
loadTexture('skyboxTex', [
    "image/strange/pos-x.png", "image/strange/neg-x.png",
    "image/strange/pos-y.png", "image/strange/neg-y.png",
    "image/strange/pos-z.png", "image/strange/neg-z.png"
    ]);
loadTexture('orbuculumTex', [pos_x, neg_x, pos_y, neg_y, neg_z, pos_z]);
loadTexture('smokeTex', ["image/Smoke-Element.png"]);
lasttime = new Date();
animate();

$(document).keydown(function(e){
    if(e.keyCode==32){
        if(document.activeElement!=document.getElementById('start_button'))startButton(e);
    }
});

mapDiv.addEventListener('imgready',function(){
    loadTexture('orbuculumTex', [pos_x, neg_x, pos_y, neg_y, neg_z, pos_z]);
});