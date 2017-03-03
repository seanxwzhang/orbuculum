
// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

// requestAnimationFrame polyfill by Erik Möller, fixes from Paul Irish and Tino Zijdel
(function() {
    
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        
        window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
    }
 
    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function(callback, element) {
            
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            
            var id = window.setTimeout(function() { 
                callback(currTime + timeToCall); 
            }, timeToCall);
            
            lastTime = currTime + timeToCall;
            return id;
        };
    }
 
    if (!window.cancelAnimationFrame) {
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
    }
}());

/*
 * the global MP object
 */
var MP = (function(window, document, undefined) {

    var gl;
    var shaderProgram;
	
    var mvMatrixStack = [];

    var theLookAtMatrix = mat4.create();
    var theModelViewMatrix = mat4.create();     // model-view matrix
    var theProjectionMatrix = mat4.create();    // projection matrix

    var pi = Math.PI;
    var poly = false;
    var lastTime = 0;

    var INDEX_DIMENSION = 1;
    var COLOR_DIMENSION = 4;
    var VERTEX_DIMENSION = 3;
    var TEXTURE_DIMENSION = 2;

	var mp = {};

    var json = null;
    var theTeapot = null;
    var theEnvironment = null;

    /*
     * the main program... creates objects, defines event listeners, starts animation
     */
    mp.Main = function() {

        function init(params) {

            var canvas = document.getElementById(mp.css.ids.CANVAS);

            mp.initGL(canvas);
            mp.initShaders();
            mp.initTextures();

            gl.clearColor(0, 0, 0, 1.0);
            gl.enable(gl.DEPTH_TEST);

            $("#zoom").slider("option", "value", 12);
            $("#ambient-intensity").slider("option", "value", 24);
            $("#specular-intensity").slider("option", "value", 48);

            loadJSON();
            theTeapot = new mp.Teapot(json["teapot"]);
            theEnvironment = new mp.Environment(json["environment"]);

            mp.animate();
            // mp.drawScene();
        };

        function loadJSON() {

            $('#status').text("fetching json file...");

            $.ajax({
                type : 'GET',
                dataType : 'text',
                url : 'mp.json',
                success : function(response) {
                    json = $.parseJSON(response);
                    $('#status').text("");
                },
                error : function() {
                    $('#status').text("fetching json file failed :(");
                },
                async : false
            });
        };

        /*************************/
        /* public interface, API */
        /*************************/
        return {
            initialize : function(options) {
                init(options);
            }
        };
    };

    /*
     * Teapot inspired from:
     * http://learningwebgl.com/lessons/lesson14/index.html
     *
     * Teapot JSON:
     * http://learningwebgl.com/lessons/lesson14/Teapot.json
     */
    mp.Teapot = function(teapotJSON) {

        var textureLookUpBuffer;
        var theTeapotNormalsBuffer;
        var theTeapotIndicesBuffer;
        var theTeapotVerticesBuffer;
        var theTeapotTextureCoordsBuffer;

        var rotation = 0;
        var json = teapotJSON;

        var theIndices = new Uint16Array(json["indices"]);
        var theVertices = new Float32Array(json["vertices"]);
        var theTextureCoords = new Float32Array(json["textureCoords"]);
        var theTextureLookup = new Float32Array(json["textureLookup"]);
        var theCalculatedNormals = new Float32Array(calculateNormals());
        var theProvidedNormals = new Float32Array(json["normals"]);

        setupTeapotBuffers();

        function calculateNormals() {

            // helpers for accessing a vector - correspond to (x,y,z) coordinates
            var x = 0, y = 1, z = 2;

            /*
             * calculate face normals
             */
            var faces = [];
            var face_normals = [];
            var numberOfIndices = theIndices.length;
            for (var i = 0; i < numberOfIndices; i += 3) {

                // get the first vertex
                var i1 = theIndices[i] * 3;
                var v1 = vec3.create([theVertices[i1], theVertices[i1 + 1], theVertices[i1 + 2]]);
                
                // get the second vertex
                var i2 = theIndices[i + 1] * 3;
                var v2 = vec3.create([theVertices[i2], theVertices[i2 + 1], theVertices[i2 + 2]]);
                
                // get the third vertex
                var i3 = theIndices[i + 2] * 3;
                var v3 = vec3.create([theVertices[i3], theVertices[i3 + 1], theVertices[i3 + 2]]);

                // store this face
                faces.push([i1, i2, i3]);

                /*
                 * To find the surface normal of the face:
                 *
                 * - Set Vector U to (Triangle.p2 minus Triangle.p1)
                 * - Set Vector V to (Triangle.p3 minus Triangle.p1)
                 *
                 * - Set Normal.x to (multiply U.y by V.z) minus (multiply U.z by V.y)
                 * - Set Normal.y to (multiply U.z by V.x) minus (multiply U.x by V.z)
                 * - Set Normal.z to (multiply U.x by V.y) minus (multiply U.y by V.x)
                 */
                var u = vec3.create();
                vec3.subtract(v2, v1, u);

                var v = vec3.create();
                vec3.subtract(v3, v1, v);

                var normal = vec3.create();
                vec3.cross(u, v, normal);

                var normalized = vec3.create();
                vec3.normalize(normal, normalized);

                face_normals.push(normalized);
            }

            /*
             * prep vertex normals
             */
            var vertex_normals = [];
            var numberOfVertices = theVertices.length;
            for (var i = 0; i < numberOfVertices; i++) {
                
                vertex_normals.push(0); // create normal accumulator, initalized to 0
            }

            /*
             * calculate vertex normals
             */
            var numberOfFaces = faces.length;
            for (var i = 0; i < numberOfFaces; i++) { // for each face

                var face = faces[i];
                var face_normal_x = face_normals[i][x];
                var face_normal_y = face_normals[i][y];
                var face_normal_z = face_normals[i][z];

                for (var j = 0; j < VERTEX_DIMENSION; j++) { // for each vertex belonging to this face - these are vertex indices

                    var vertex_index = face[j];

                    vertex_normals[vertex_index + x] += face_normal_x;
                    vertex_normals[vertex_index + y] += face_normal_y;
                    vertex_normals[vertex_index + z] += face_normal_z;
                }
            }

            /*
             * normalize vertex normals
             */
            var result = [];
            var numberOfVertexNormals = vertex_normals.length;
            for (var i = 0; i < numberOfVertexNormals; i += 3) {

                var normal_x = vertex_normals[i + x];
                var normal_y = vertex_normals[i + y];
                var normal_z = vertex_normals[i + z];
                var normal = vec3.create([normal_x, normal_y, normal_z]);

                var normalized = vec3.create();
                vec3.normalize(normal, normalized);

                result.push(normalized[x]);
                result.push(normalized[y]);
                result.push(normalized[z]);
            }

            return result;
        };

        var theLondonEnvironment;
        var theCheckerboardEnvironment;
        initEnvironmentCubeMap();
        
        function initEnvironmentCubeMap() {

            theLondonEnvironment = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, theLondonEnvironment);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

            var cubeFaces = [
                ["images/pos-x.png", gl.TEXTURE_CUBE_MAP_POSITIVE_X],
                ["images/neg-x.png", gl.TEXTURE_CUBE_MAP_NEGATIVE_X],
                ["images/pos-y.png", gl.TEXTURE_CUBE_MAP_POSITIVE_Y],
                ["images/neg-y.png", gl.TEXTURE_CUBE_MAP_NEGATIVE_Y],
                ["images/pos-z.png", gl.TEXTURE_CUBE_MAP_POSITIVE_Z],
                ["images/neg-z.png", gl.TEXTURE_CUBE_MAP_NEGATIVE_Z]
            ];

            for (var i = 0; i < cubeFaces.length; i++) {

                var image = new Image();
                image.src = cubeFaces[i][0];
                image.onload = function(texture, face, image) {

                    return function() {
                        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture)
                        gl.texImage2D(face, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
                    }
                } (theLondonEnvironment, cubeFaces[i][1], image);
            }

            theCheckerboardEnvironment = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, theCheckerboardEnvironment);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

            var cbFaces = [
                ["images/cb.png", gl.TEXTURE_CUBE_MAP_POSITIVE_X],
                ["images/cb.png", gl.TEXTURE_CUBE_MAP_NEGATIVE_X],
                ["images/cb.png", gl.TEXTURE_CUBE_MAP_POSITIVE_Y],
                ["images/cb.png", gl.TEXTURE_CUBE_MAP_NEGATIVE_Y],
                ["images/cb.png", gl.TEXTURE_CUBE_MAP_POSITIVE_Z],
                ["images/cb.png", gl.TEXTURE_CUBE_MAP_NEGATIVE_Z]
            ];

            for (var i = 0; i < cbFaces.length; i++) {

                var image = new Image();
                image.src = cbFaces[i][0];
                image.onload = function(texture, face, image) {

                    return function() {
                        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture)
                        gl.texImage2D(face, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
                    }
                } (theCheckerboardEnvironment, cbFaces[i][1], image);
            }
        };

        function setupTeapotBuffers() {

            theTeapotCalculatedNormalsBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, theTeapotCalculatedNormalsBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, theCalculatedNormals, gl.STATIC_DRAW);
            theTeapotCalculatedNormalsBuffer.itemSize = VERTEX_DIMENSION;
            theTeapotCalculatedNormalsBuffer.numItems = (theCalculatedNormals.length / VERTEX_DIMENSION);

            theTeapotProvidedNormalsBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, theTeapotProvidedNormalsBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, theProvidedNormals, gl.STATIC_DRAW);
            theTeapotProvidedNormalsBuffer.itemSize = VERTEX_DIMENSION;
            theTeapotProvidedNormalsBuffer.numItems = (theProvidedNormals.length / VERTEX_DIMENSION);

            theTeapotVerticesBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, theTeapotVerticesBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, theVertices, gl.STATIC_DRAW);
            theTeapotVerticesBuffer.itemSize = VERTEX_DIMENSION;
            theTeapotVerticesBuffer.numItems = (theVertices.length / VERTEX_DIMENSION);

            theTeapotIndicesBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, theTeapotIndicesBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, theIndices, gl.STATIC_DRAW);
            theTeapotIndicesBuffer.itemSize = INDEX_DIMENSION;
            theTeapotIndicesBuffer.numItems = theIndices.length;

            theTeapotTextureCoordsBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, theTeapotTextureCoordsBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, theTextureCoords, gl.STATIC_DRAW);
            theTeapotTextureCoordsBuffer.itemSize = TEXTURE_DIMENSION;
            theTeapotTextureCoordsBuffer.numItems = (theTextureCoords.length / TEXTURE_DIMENSION);

            textureLookUpBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, textureLookUpBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(theTextureLookup), gl.STATIC_DRAW);
            textureLookUpBuffer.itemSize = INDEX_DIMENSION;
            textureLookUpBuffer.numItems = (theTextureLookup / INDEX_DIMENSION);
        };

        function drawTeapot() {

            mp.mvPushMatrix();

            // change up the model-view matrix
            mat4.identity(theModelViewMatrix);
            mat4.translate(theModelViewMatrix, [0.0, 0.0, -5.0]);

            var z = $("#zoom").slider("option", "value") / 100;

            mat4.rotate(theModelViewMatrix, mp.degToRad(10), [1, 0, 0]);
            mat4.rotate(theModelViewMatrix, mp.degToRad(rotation / (z * 100 / 6)), [.2, 1, 0]);

            mat4.scale(theModelViewMatrix, [z, z, z]);

            gl.uniform1i(shaderProgram.useEnvironmentTexturesUniform, false);

            setTexture();

            gl.bindBuffer(gl.ARRAY_BUFFER, theTeapotVerticesBuffer);
            gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, theTeapotVerticesBuffer.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, theTeapotTextureCoordsBuffer);
            gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, theTeapotTextureCoordsBuffer.itemSize, gl.FLOAT, false, 0, 0);

            var normal = $('input[name="normals"]:checked').val();
            if (normal === "calculated") {

                gl.bindBuffer(gl.ARRAY_BUFFER, theTeapotCalculatedNormalsBuffer);
                gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, theTeapotCalculatedNormalsBuffer.itemSize, gl.FLOAT, false, 0, 0);

            } else if (normal === "provided") {

                gl.bindBuffer(gl.ARRAY_BUFFER, theTeapotProvidedNormalsBuffer);
                gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, theTeapotProvidedNormalsBuffer.itemSize, gl.FLOAT, false, 0, 0);

            }

            gl.bindBuffer(gl.ARRAY_BUFFER, textureLookUpBuffer);
            gl.vertexAttribPointer(shaderProgram.textureLookUpAttribute, textureLookUpBuffer.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, theTeapotIndicesBuffer);
            mp.setMatrixUniforms();
            gl.drawElements(gl.TRIANGLES, theTeapotIndicesBuffer.numItems, gl.UNSIGNED_SHORT, 0);

            mp.mvPopMatrix();

        };

        function setTexture() {

            var texture = $('input[name="texture"]:checked').val();
            var useTexture = true;
            if (texture === "none") {
                useTexture = false;
            }
            gl.uniform1i(shaderProgram.useTexturesUniform, useTexture);
            gl.uniform1i(shaderProgram.useEnvironmentReflectionUniform, false);
            
            if (texture === "none") {

                mp.setTextures([
                    ["TEXTURE_2D", null, "textureMapSamplerUniform"],
                    ["TEXTURE_2D", null, "textureBumpMapSamplerUniform"],
                    ["TEXTURE_CUBE_MAP", null, "cubeMapSampler"]
                ]);

                gl.uniform1i(shaderProgram.showSpecularHighlightsUniform, false);
                gl.uniform1f(shaderProgram.materialShininessUniform, 2);

            } else if (texture === "earth") {

                mp.setTextures([
                    ["TEXTURE_2D", earthTexture, "textureMapSamplerUniform"],
                    ["TEXTURE_2D", earthBumpTexture, "textureBumpMapSamplerUniform"],
                    ["TEXTURE_CUBE_MAP", null, "cubeMapSampler"]
                ]);

            } else if (texture === "checkerboard") {

                mp.setTextures([
                    ["TEXTURE_2D", checkerboardTexture, "textureMapSamplerUniform"],
                    ["TEXTURE_2D", checkerboardBumpTexture, "textureBumpMapSamplerUniform"],
                    ["TEXTURE_CUBE_MAP", null, "cubeMapSampler"]
                ]);

            } else if (texture === "mirror") {

                gl.uniform1i(shaderProgram.useEnvironmentReflectionUniform, true);
                var texture = $('input[name="environment-texture"]:checked').val();

                if (texture === "e-checkerboard") {

                    if ($('#mirror-texture').is(":checked")) {

                        $("#diffuse-intensity").slider("option", "value", 100)
                        gl.uniform1i(shaderProgram.useEnvironmentReflectionAndTextureUniform, true);

                        mp.setTextures([
                            ["TEXTURE_2D", earthTexture, "textureMapSamplerUniform"],
                            ["TEXTURE_2D", earthBumpTexture, "textureBumpMapSamplerUniform"],
                            ["TEXTURE_CUBE_MAP", theCheckerboardEnvironment, "cubeMapSampler"]
                        ]);

                    } else {

                        $("#diffuse-intensity").slider("option", "value", 0)
                        gl.uniform1i(shaderProgram.useEnvironmentReflectionAndTextureUniform, false);

                        mp.setTextures([
                            ["TEXTURE_2D", null, "textureMapSamplerUniform"],
                            ["TEXTURE_2D", null, "textureBumpMapSamplerUniform"],
                            ["TEXTURE_CUBE_MAP", theCheckerboardEnvironment, "cubeMapSampler"]
                        ]);
                    }

                } else if (texture === "london") {

                    if ($('#mirror-texture').is(":checked")) {

                        $("#diffuse-intensity").slider("option", "value", 0)
                        gl.uniform1i(shaderProgram.useEnvironmentReflectionAndTextureUniform, true);

                        mp.setTextures([
                            ["TEXTURE_2D", checkerboardTexture, "textureMapSamplerUniform"],
                            ["TEXTURE_2D", checkerboardBumpTexture, "textureBumpMapSamplerUniform"],
                            ["TEXTURE_CUBE_MAP", theLondonEnvironment, "cubeMapSampler"]
                        ]);

                    } else {

                        $("#diffuse-intensity").slider("option", "value", 0)
                        gl.uniform1i(shaderProgram.useEnvironmentReflectionAndTextureUniform, false);

                        mp.setTextures([
                            ["TEXTURE_2D", null, "textureMapSamplerUniform"],
                            ["TEXTURE_2D", null, "textureBumpMapSamplerUniform"],
                            ["TEXTURE_CUBE_MAP", theLondonEnvironment, "cubeMapSampler"]
                        ]);
                    }
                }
            }
        };

        return {
            draw : function() {
                drawTeapot();
            },
            updateRotation : function(rot) {
                rotation += rot;
            }
        };
    };


    mp.Environment = function(json) {

        var theIndices = new Uint16Array(json["indices"]);
        var theNormals = new Float32Array(json["normals"]);
        var theVertices = new Float32Array(json["vertices"]);
        var theTextureCoords = new Float32Array(json["textureCoords"]);
        var theTextureLookup = new Float32Array(json["textureLookup"]);

        var textureLookUpBuffer;
        var theEnvironmentNormalsBuffer;
        var theEnvironmentIndicesBuffer;
        var theEnvironmentVerticesBuffer;
        var theEnvironmentTextureCoordsBuffer;
        setupEnvironmentBuffers();
        initEnvironmentTextures();

        /*
         * http://webglfactory.blogspot.com/2011/05/adding-textures.html
         */
        function initEnvironmentTextures() {

            frontTexture = gl.createTexture();
            frontTexture.image = new Image();
            frontTexture.image.onload = function () {
                mp.handleLoadedTexture(frontTexture);
            }
            frontTexture.image.src = "images/pos-z.png";

            backTexture = gl.createTexture();
            backTexture.image = new Image();
            backTexture.image.onload = function () {
                mp.handleLoadedTexture(backTexture);
            }
            backTexture.image.src = "images/neg-z.png";

            topTexture = gl.createTexture();
            topTexture.image = new Image();
            topTexture.image.onload = function () {
                mp.handleLoadedTexture(topTexture);
            }
            topTexture.image.src = "images/pos-y.png";

            bottomTexture = gl.createTexture();
            bottomTexture.image = new Image();
            bottomTexture.image.onload = function () {
                mp.handleLoadedTexture(bottomTexture);
            }
            bottomTexture.image.src = "images/neg-y-2.png";

            rightTexture = gl.createTexture();
            rightTexture.image = new Image();
            rightTexture.image.onload = function () {
                mp.handleLoadedTexture(rightTexture);
            }
            rightTexture.image.src = "images/pos-x.png";

            leftTexture = gl.createTexture();
            leftTexture.image = new Image();
            leftTexture.image.onload = function () {
                mp.handleLoadedTexture(leftTexture);
            }
            leftTexture.image.src = "images/neg-x.png";
        }

        function setupEnvironmentBuffers() {

            theEnvironmentNormalsBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, theEnvironmentNormalsBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(theNormals), gl.STATIC_DRAW);
            theEnvironmentNormalsBuffer.itemSize = VERTEX_DIMENSION;
            theEnvironmentNormalsBuffer.numItems = (theNormals.length / VERTEX_DIMENSION);

            theEnvironmentVerticesBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, theEnvironmentVerticesBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(theVertices), gl.STATIC_DRAW);
            theEnvironmentVerticesBuffer.itemSize = VERTEX_DIMENSION;
            theEnvironmentVerticesBuffer.numItems = (theVertices.length / VERTEX_DIMENSION);

            theEnvironmentIndicesBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, theEnvironmentIndicesBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(theIndices), gl.STATIC_DRAW);
            theEnvironmentIndicesBuffer.itemSize = INDEX_DIMENSION;
            theEnvironmentIndicesBuffer.numItems = theIndices.length;

            theEnvironmentTextureCoordsBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, theEnvironmentTextureCoordsBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(theTextureCoords), gl.STATIC_DRAW);
            theEnvironmentTextureCoordsBuffer.itemSize = TEXTURE_DIMENSION;
            theEnvironmentTextureCoordsBuffer.numItems = (theTextureCoords.length / TEXTURE_DIMENSION);

            textureLookUpBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, textureLookUpBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(theTextureLookup), gl.STATIC_DRAW);
            textureLookUpBuffer.itemSize = INDEX_DIMENSION;
            textureLookUpBuffer.numItems = (theTextureLookup.length / INDEX_DIMENSION);
        };

        function drawEnvironment() {

            mp.mvPushMatrix();

            // change up the model-view matrix
            mat4.identity(theModelViewMatrix);
            mat4.translate(theModelViewMatrix, [0.0, 0.0, -7.0]);

            mat4.rotate(theModelViewMatrix, mp.degToRad(35), [0, 1, 0]);
            mat4.rotate(theModelViewMatrix, mp.degToRad(10), [1, 0, 1]);
            mat4.scale(theModelViewMatrix, [10,10,10]);

            gl.uniform1i(shaderProgram.useTexturesUniform, true);
            gl.uniform1i(shaderProgram.showSpecularHighlightsUniform, false);                
            gl.uniform1f(shaderProgram.materialShininessUniform, 2);

            gl.uniform1i(shaderProgram.useEnvironmentReflectionUniform, false);

            setTexture();

            gl.bindBuffer(gl.ARRAY_BUFFER, theEnvironmentVerticesBuffer);
            gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, theEnvironmentVerticesBuffer.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, theEnvironmentTextureCoordsBuffer);
            gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, theEnvironmentTextureCoordsBuffer.itemSize, gl.FLOAT, false, 0, 0);            

            gl.bindBuffer(gl.ARRAY_BUFFER, theEnvironmentNormalsBuffer);
            gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, theEnvironmentNormalsBuffer.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, theEnvironmentIndicesBuffer);
            mp.setMatrixUniforms();
            gl.drawElements(gl.TRIANGLES, theEnvironmentIndicesBuffer.numItems, gl.UNSIGNED_SHORT, 0);

            mp.mvPopMatrix();
        };

        var frontTexture;
        var backTexture;
        var topTexture;
        var bottomTexture;
        var leftTexture;
        var rightTexture;
        function setTexture() {

            var texture = $('input[name="environment-texture"]:checked').val();
            if (texture === "e-checkerboard") {

                gl.uniform1i(shaderProgram.useEnvironmentTexturesUniform, false);
                gl.uniform1i(shaderProgram.useEnvironmentReflectionAndTextureUniform, false);

                mp.setTextures([
                    ["TEXTURE_2D", checkerboardTexture, "textureMapSamplerUniform"],
                    ["TEXTURE_2D", null, "textureBumpMapSamplerUniform"],
                    ["TEXTURE_CUBE_MAP", null, "cubeMapSampler"],
                    ["TEXTURE_2D", null, "front"],
                    ["TEXTURE_2D", null, "back"],
                    ["TEXTURE_2D", null, "top"],
                    ["TEXTURE_2D", null, "bottom"],
                    ["TEXTURE_2D", null, "right"],
                    ["TEXTURE_2D", null, "left"],
                ]);

            } else if (texture === "london") {

                gl.uniform1i(shaderProgram.useLightUniform, false);
                gl.uniform1i(shaderProgram.showSpecularHighlightsUniform, false);
                gl.uniform1f(shaderProgram.materialShininessUniform, 2);
                gl.uniform1i(shaderProgram.useEnvironmentTexturesUniform, true);
                gl.uniform1i(shaderProgram.useEnvironmentReflectionAndTextureUniform, false);

                mp.setTextures([
                    ["TEXTURE_2D", null, "textureMapSamplerUniform"],
                    ["TEXTURE_2D", null, "textureBumpMapSamplerUniform"],
                    ["TEXTURE_CUBE_MAP", null, "cubeMapSampler"],
                    ["TEXTURE_2D", frontTexture, "front"],
                    ["TEXTURE_2D", backTexture, "back"],
                    ["TEXTURE_2D", topTexture, "top"],
                    ["TEXTURE_2D", bottomTexture, "bottom"],
                    ["TEXTURE_2D", rightTexture, "right"],
                    ["TEXTURE_2D", leftTexture, "left"],
                ]);

                gl.bindBuffer(gl.ARRAY_BUFFER, textureLookUpBuffer);
                gl.vertexAttribPointer(shaderProgram.textureLookUpAttribute, textureLookUpBuffer.itemSize, gl.FLOAT, false, 0, 0);
            }
        };

        return {
            draw : function() {
                drawEnvironment();
            }
        };
    };

    /********************/
    /* static variables */
    /********************/
    mp.css = {};
    mp.css.ids = {
        CANVAS : 'main-canvas'
    };

    mp.css.classes = {};

    /******************/
    /* static methods */
    /******************/

    /*
     * draws each object on the screen
     */
    mp.drawScene = function() {

        gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        mat4.perspective(46, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, theProjectionMatrix);

        // take care of light
        if ($('#light').is(':checked')) {

            gl.uniform1i(shaderProgram.useLightUniform, true);
            gl.uniform1i(shaderProgram.showSpecularHighlightsUniform, true);
            gl.uniform1f(shaderProgram.materialShininessUniform, 10);

            // ambient light
            var ai = $("#ambient-intensity" ).slider("option", "value") / 100;
            gl.uniform3f(shaderProgram.ambientColorUniform, ai, ai, ai);

            // point light
            var si = $("#specular-intensity").slider("option", "value") / 100;
            si *= 2;
            var di = $("#diffuse-intensity").slider("option", "value") / 100;
            gl.uniform3f(shaderProgram.pointLightLocationUniform, 10.0, 0.0, 10.0);
            gl.uniform3f(shaderProgram.pointLightSpecularColorUniform, si, si, si);
            gl.uniform3f(shaderProgram.pointLightDiffuseColorUniform, di, di, di);

        } else {
            gl.uniform1i(shaderProgram.useLightUniform, false);
        }

        if ($('#environment').is(':checked')) {
            theEnvironment.draw();
        }

        theTeapot.draw();
    };

    /*
     * does the actual "animation" part
     */
    mp.request;
    mp.animate = function() {

        function foo() {
            mp.animate();
        };

        mp.request = window.requestAnimationFrame(foo);
        mp.drawScene();

        mp.tick();
    };

    /*
     * each frame that is drawn to the screen is a result of this function's work
     */
    mp.tick = function() {

        var timeNow = new Date().getTime();
        
        if (lastTime != 0) {

            var elapsed = timeNow - lastTime;
            theTeapot.updateRotation((90 * elapsed) / 1000.0);
        }

        lastTime = timeNow;
    };

    mp.degToRad = function(degrees) {
        return degrees * Math.PI / 180;
    };

    mp.mvPushMatrix = function() {
        var copy = mat4.create();
        mat4.set(theModelViewMatrix, copy);
        mvMatrixStack.push(copy);
    };

    mp.mvPopMatrix = function() {
        if (mvMatrixStack.length == 0) {
            throw "Invalid popMatrix!";
        }
        theModelViewMatrix = mvMatrixStack.pop();
    };

    mp.setMatrixUniforms = function() {
        gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, theProjectionMatrix);
        gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, theModelViewMatrix);

        var normalMatrix = mat3.create();
        mat4.toInverseMat3(theModelViewMatrix, normalMatrix);
        mat3.transpose(normalMatrix);
        gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, normalMatrix);
    };

    mp.initGL = function(canvas) {
        try {
            gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            gl.viewportWidth = canvas.width;
            gl.viewportHeight = canvas.height;
        } catch (e) {
            console.log(e);
        }

        if (!gl) {
            alert("Could not initialize WebGL");
        }
    };

    mp.setTextures = function(textures) {

        for (var i = 0; i < textures.length; i++) {

            var info = textures[i];

            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl[info[0]], info[1]);
            gl.uniform1i(shaderProgram[info[2]], i);
        }
    };

    mp.initShaders = function() {
        var fragmentShader = mp.getShader(gl, "shader-fs");
        var vertexShader = mp.getShader(gl, "shader-vs");

        shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            alert("Could not initialise shaders");
        }

        gl.useProgram(shaderProgram);

        shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
        gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

        shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
        gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

        shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
        gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

        shaderProgram.textureLookUpAttribute = gl.getAttribLocation(shaderProgram, "aFace");
        gl.enableVertexAttribArray(shaderProgram.textureLookUpAttribute);

        shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
        shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
        shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");

        shaderProgram.cubeMapSampler = gl.getUniformLocation(shaderProgram, "uCubeSampler");
        shaderProgram.textureMapSamplerUniform = gl.getUniformLocation(shaderProgram, "uTextureMapSampler");
        shaderProgram.textureBumpMapSamplerUniform = gl.getUniformLocation(shaderProgram, "uTextureBumpMapSampler");

        shaderProgram.useTexturesUniform = gl.getUniformLocation(shaderProgram, "uUseTextures");
        shaderProgram.useEnvironmentTexturesUniform = gl.getUniformLocation(shaderProgram, "uUseEnvironmentTexture");
        shaderProgram.useEnvironmentReflectionUniform = gl.getUniformLocation(shaderProgram, "uUseEnvironmentReflection");
        shaderProgram.useEnvironmentReflectionAndTextureUniform = gl.getUniformLocation(shaderProgram, "uUseEnvironmentReflectionAndTexture");
        shaderProgram.useLightUniform = gl.getUniformLocation(shaderProgram, "uUseLight");
        shaderProgram.ambientColorUniform = gl.getUniformLocation(shaderProgram, "uAmbientColor");

        shaderProgram.materialShininessUniform = gl.getUniformLocation(shaderProgram, "uMaterialShininess");
        shaderProgram.showSpecularHighlightsUniform = gl.getUniformLocation(shaderProgram, "uShowSpecularHighlights");
        shaderProgram.pointLightLocationUniform = gl.getUniformLocation(shaderProgram, "uPointLightLocation");
        shaderProgram.pointLightSpecularColorUniform = gl.getUniformLocation(shaderProgram, "uPointLightSpecularColor");
        shaderProgram.pointLightDiffuseColorUniform = gl.getUniformLocation(shaderProgram, "uPointLightDiffuseColor");

        shaderProgram.front = gl.getUniformLocation(shaderProgram, "front");
        shaderProgram.back = gl.getUniformLocation(shaderProgram, "back");
        shaderProgram.top = gl.getUniformLocation(shaderProgram, "top");
        shaderProgram.bottom = gl.getUniformLocation(shaderProgram, "bottom");
        shaderProgram.right = gl.getUniformLocation(shaderProgram, "right");
        shaderProgram.left = gl.getUniformLocation(shaderProgram, "left");

    };

    /*
     * code from online tutorial: http://learningwebgl.com/
     */
    mp.getShader = function(gl, id) {
        var shaderScript = document.getElementById(id);
        if (!shaderScript) {
            return null;
        }

        var str = "";
        var k = shaderScript.firstChild;
        while (k) {
            if (k.nodeType == 3) {
                str += k.textContent;
            }
            k = k.nextSibling;
        }

        var shader;
        if (shaderScript.type == "x-shader/x-fragment") {
            shader = gl.createShader(gl.FRAGMENT_SHADER);
        } else if (shaderScript.type == "x-shader/x-vertex") {
            shader = gl.createShader(gl.VERTEX_SHADER);
        } else {
            return null;
        }

        gl.shaderSource(shader, str);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            alert(gl.getShaderInfoLog(shader));
            return null;
        }

        return shader;
    };

    var earthTexture;
    var earthBumpTexture;
    var checkerboardTexture;
    var checkerboardBumpTexture;
    mp.initTextures = function() {

        checkerboardTexture = gl.createTexture();
        checkerboardTexture.image = new Image();
        checkerboardTexture.image.onload = function () {
            mp.handleLoadedTexture(checkerboardTexture)
        }
        checkerboardTexture.image.src = "images/cb.png";

        checkerboardBumpTexture = gl.createTexture();
        checkerboardBumpTexture.image = new Image();
        checkerboardBumpTexture.image.onload = function () {
            mp.handleLoadedTexture(checkerboardBumpTexture)
        }
        checkerboardBumpTexture.image.src = "images/cb_bump.png";

        earthTexture = gl.createTexture();
        earthTexture.image = new Image();
        earthTexture.image.onload = function () {
            mp.handleLoadedTexture(earthTexture)
        }
        earthTexture.image.src = "images/earth.png";

        earthBumpTexture = gl.createTexture();
        earthBumpTexture.image = new Image();
        earthBumpTexture.image.onload = function () {
            mp.handleLoadedTexture(earthBumpTexture)
        }
        earthBumpTexture.image.src = "images/earth_bump.png";
    };

    /*
     * code from online tutorial: http://learningwebgl.com/
     */
    mp.handleLoadedTexture = function(texture) {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, null);
    };

    /*************************/
    /* public interface, API */
    /*************************/
    return {
        initialize : function() {
            var mp1 = new mp.Main();
            mp1.initialize();
        },
        getInstance : function() {
            return mp;
        }
    };

})(this, this.document);



