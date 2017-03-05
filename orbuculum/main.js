"use strict";

var gl; // webgl context
var canvas;

var prog_Box; // skybox program
var skybox;// skybox object

var prog; // orbuculum program
var orbuculum; // orbuculum object

var rotator; // rotator object

var projection = mat4.create();
var modelview = mat4.create();
var normalMV = mat3.create();
var invMV = mat3.create();

var skyboxTex; // texture ID for the skybox
var orbuculumTex = skyboxTex; // they are using the same cube mapping for now


function draw() {
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mat4.perspective(projection, Math.PI/3, canvas.width/canvas.height, 10, 2000);

    modelview = rotator.getViewMatrix();
    mat3.normalFromMat4(normalMV, modelview);
    mat3.fromMat4(invMV, modelview);
    mat3.invert(invMV, invMV);

    // // draw skybox
    if (skyboxTex) {
        gl.useProgram(prog_Box);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyboxTex);
        gl.enableVertexAttribArray(skybox.coords_loc);
        skybox.render(projection, modelview);
        gl.disableVertexAttribArray(skybox.coords_loc);
    }

    // draw orbuculum
    orbuculumTex = skyboxTex;
    if (orbuculumTex && orbuculum) {
        gl.useProgram(prog);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, orbuculumTex);
        gl.enableVertexAttribArray(orbuculum.coords_loc);
        gl.enableVertexAttribArray(orbuculum.normal_loc);
        orbuculum.render(projection, modelview, normalMV, invMV);
        gl.disableVertexAttribArray(orbuculum.coords_loc);
        gl.disableVertexAttribArray(orbuculum.normal_loc);
    }

}

function loadTextureCube(urls) {
    var ct = 0;
    var img = new Array(6);
    var urls = [
    "image/park/pos-x.jpg", "image/park/neg-x.jpg",
    "image/park/pos-y.jpg", "image/park/neg-y.jpg",
    "image/park/pos-z.jpg", "image/park/neg-z.jpg"
    ];
    for (var i = 0; i < 6; i++) {
        img[i] = new Image();
        img[i].onload = function() {
            ct++;
            if (ct == 6) {
                skyboxTex = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyboxTex);
                var targets = [
                gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
                ];
                for (var j = 0; j < 6; j++) {
                    gl.texImage2D(targets[j], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img[j]);
                    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                }
                gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
                draw();
            }
        }
        img[i].src = urls[i];
    }
}

function init() {
    try {
        canvas = document.getElementById("glcanvas");
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

        rotator = new SimpleRotator(canvas, draw);
        rotator.setView([0,0,1], [0,1,0], 20);

        skybox = new Cube(100);
        orbuculum = new Sphere(5);

        skybox.link(gl, prog_Box);
        skybox.upload(gl);
        orbuculum.link(gl, prog);
        orbuculum.upload(gl);
        

    }
    catch(e) {
        document.getElementById("message").innerHTML = "Your browser might not support WebGl: " + e;
        return;
    }
}

// main function
init();
loadTextureCube();

