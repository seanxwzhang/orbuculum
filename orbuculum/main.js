"use strict";

var gl; // webgl context
var canvas;

var prog_Box; // skybox program
var skybox;// skybox object

var prog; // orbuculum program
var orbuculum; // orbuculum object

var prog_shadow;
var prog_shadow_gen;

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

var textures = {};

var toggle = false;
function draw() {
    //generateShadowMap();
	
	gl.clearColor(0,0,0,1);
	gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    

    modelview = rotator.getViewMatrix();
	//mat4.multiply(modelview,temp, modelview);
	//mat4.multiply(modelview, temp1,modelview);
    mat3.normalFromMat4(normalMV, modelview);
    mat3.fromMat4(invMV, modelview);
    mat3.invert(invMV, invMV);

    // draw skybox
    if (textures.skyboxTex&&toggle) {
        //skybox.link(gl, prog_Box);
		gl.useProgram(prog_Box);		
		gl.uniform3fv(gl.getUniformLocation(prog_Box,"lightPosition"),lightPosition);
		gl.uniform1i(gl.getUniformLocation(prog_Box,"skybox"), 0);
		gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, textures.skyboxTex);
        gl.enableVertexAttribArray(skybox.coords_loc);
		gl.enableVertexAttribArray(skybox.normal_loc);
        //skybox.render(projection, mat4.multiply(mat4.create(),temp1,mat4.multiply(mat4.create(), temp,oldmodelview)));
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
        //skybox.render(projection, mat4.multiply(mat4.create(),mat4.multiply(mat4.create(), oldmodelview,temp),temp1));
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

}

const inmemoryCanvases = [1,2,3,4,5,6]
    .map(id => `inmemoryCanvas${id}`)
    .map(id => {
        const canvas = document.createElement('canvas');
        canvas.setAttribute('id', id);
        canvas.width = 1; canvas.height = 1;
        return canvas;
    });
function loadTextureCube(texID, urls) {
    Promise.all(urls.map((url, idx) => {
        return new Promise(resolve => {
            let img = new Image();
            img.crossOrigin = '';
            img.onload = function() {
                resolve(img);
            }
            img.src = url;
        }).then(img => {
            if (texID === 'orbuculumTex') {
                return new Promise(resolve => {
                    const blurRadius = 0;
                    stackBlurImage(img, inmemoryCanvases[idx], blurRadius, false);
                    const bluredImg = new Image();
                    bluredImg.onload = function() {
                        resolve(bluredImg);
                    }
                    bluredImg.src = inmemoryCanvases[idx].toDataURL();
                })
            } else {
                return img;
            }
        })
    })).then(imgs => {
        textures[texID] = gl.createTexture();
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
        draw();
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
	} 
	else {
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
		mat4.perspective(projection, Math.PI/3, canvas.width/canvas.height, 0.35, 1000);
		
        skybox = new Cube(50);
        orbuculum = new Sphere(7);

        if(toggle)skybox.link(gl, prog_Box);
		else skybox.link(gl, prog_shadow);
        skybox.upload(gl);
        orbuculum.link(gl, prog);
        orbuculum.upload(gl);

		generateShadowMap();

    }
    catch(e) {
        document.getElementById("message").innerHTML = "Your browser might not support WebGl: " + e;
        return;
    }
}

// main function
init();
initMap();
loadTextureCube('skyboxTex', [
    "image/strange/pos-x.png", "image/strange/neg-x.png",
    "image/strange/pos-y.png", "image/strange/neg-y.png",
    "image/strange/pos-z.png", "image/strange/neg-z.png"
    ]);
loadTextureCube('orbuculumTex', [pos_x, neg_x, pos_y, neg_y, neg_z, pos_z]);

/* $(document).keydown(function(e){
    moveLocation(e);
    loadTextureCube('orbuculumTex', [pos_x, neg_x, pos_y, neg_y, neg_z, pos_z]);
}) */

/* mapDiv.addEventListener('keydown',function(e){
	moveLocation(e);
    loadTextureCube('orbuculumTex', [pos_x, neg_x, pos_y, neg_y, neg_z, pos_z]);
}); */

$(document).keydown(function(e){
	if(e.keyCode==32){
		if(document.activeElement!=document.getElementById('start_button'))startButton(e);
	}
	/* else if(e.keyCode == '38'){
		//up arrow
		cam_nav_up(1);
	}
	else if(e.keyCode == '40'){
		//down arrow
		cam_nav_up(-1);
		//cam_nav_down();
	}
	else if(e.keyCode == '37'){
		//left arrow
		cam_nav_left(1);
	}
	else if(e.keyCode == '39'){
		//right arrow
		cam_nav_left(-1);		
	} */
});
/* var temp = mat4.create();
var temp1 = mat4.create();
function cam_nav_up(j){
	//var temp = mat4.create();
	//mat4.identity(temp);
	mat4.translate(temp,temp,[0,0,j]);
	
	//mat4.multiply(modelview, modelview,temp);
	draw();
}

function cam_nav_left(i){
	mat4.rotateY(temp1,temp1,i*Math.PI/45);
	draw();
} */

mapDiv.addEventListener('imgready',function(){
	loadTextureCube('orbuculumTex', [pos_x, neg_x, pos_y, neg_y, neg_z, pos_z]);
});