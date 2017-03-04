/**
 * Class definition for drawing obuculums and other stuff
 * Heavily depended on ECMAScript 6's new feature and gl-matrix
 * @Created by Xiaowen Zhang
 * @Edited on March 2nd, 2016
 */
"use strict";
var TWOD_MAPPING = 0;
var CUBE_MAPPING = 1;

function flatten(arr) {
  return arr.reduce(function (flat, toFlatten) {
    return flat.concat((Array.isArray(toFlatten) || toFlatten instanceof Float32Array) ? flatten(toFlatten) : toFlatten);
  }, []);
}

class Shape {
    /** 
     * Function to be overloaded by specific class
     * 
     * Things to define: [name] [type] [meaning]
     * @ vertices [Array of vec3] 
     * @ indexed [Bool] if use webgl index mode
     * @ indices [Array of integers] Used in index mode
     * @ texMode = [enum]
     * @ texCoords [Array of vec2 or vec3]
     * @ normals [Bool] if use 
     */
    constructor(){
        this.vertices = [];
        this.normals = [];
        this.indices = [];
        this.texCoords = [];
        this.texMode = CUBE_MAPPING;
        this.indexed = true;
        this.sent_to_GPU = true;
    }
    link(gl, program) {
        this.program = program;
        this.coords_loc = gl.getAttribLocation(program, "coords");
        this.modelview_loc = gl.getUniformLocation(program, "modelview");
        this.projection_loc = gl.getUniformLocation(program, "projection");
    }
    upload(gl) {
        this.coordsBuffer = gl.createBuffer();
        this.indexBuffer = gl.createBuffer();
        this.count = this.indexed ? this.indices.length : this.vertices.length;
        // push vertices to GPU
        gl.bindBuffer(gl.ARRAY_BUFFER, this.coordsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flatten(this.vertices)), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.indices), gl.STATIC_DRAW);

        this.copy_to_GPU = true;
    }
    render() { // to be overloaded
    }
}

class Sphere extends Shape {
    constructor (radius) {
        super();
        this.radius = radius || 1;
        this.resolution = 10;
        this.n_latitude = Math.floor(radius * this.resolution);
		this.n_longitude = Math.floor(radius * this.resolution);
        for (let latNum = 0; latNum <= this.n_latitude; latNum++) {
            let theta = latNum * Math.PI / this.n_latitude;
            let sinTheta = Math.sin(theta);
            let cosTheta = Math.cos(theta);
            for (let lonNum = 0; lonNum <= this.n_longitude; lonNum ++) {
                let phi = lonNum * 2 * Math.PI / this.n_longitude;
                let sinPhi = Math.sin(phi);
                let cosPhi = Math.cos(phi);

                let x = cosPhi * sinTheta;
                let y = cosTheta;
                let z = sinTheta * sinPhi;

                this.normals.push(new Float32Array([x,y,z]));
                this.vertices.push(new Float32Array([radius * x, radius * y, radius * z]));
                this.texCoords.push(new Float32Array([]));
            }
        }

        for (let latNum = 0; latNum < this.n_latitude; latNum++) {
            for (let lonNum = 0; lonNum < this.n_longitude; lonNum++) {
              let first = (latNum * (this.n_longitude + 1)) + lonNum;
              let second = first + this.n_longitude + 1;
              
              this.indices.push(first);
              this.indices.push(second);
              this.indices.push(first + 1);

              this.indices.push(second);
              this.indices.push(second + 1);
              this.indices.push(first + 1);
          }
        }
    }
    link(gl, program) {
        super.link(gl, program);
        this.normal_loc = gl.getAttribLocation(program, "normal");
        this.normalMV_loc = gl.getUniformLocation(program, "normalMV");
        this.invMV_loc = gl.getUniformLocation(program, "invMV");
    }
    upload(gl) {
        super.upload(gl);
        this.normalBuffer = gl.createBuffer();
        // push normals to GPU
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flatten(this.normals)), gl.STATIC_DRAW);

        this.copy_to_GPU = true;
    }
    render(projection, modelview, normalMV, invMV) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.coordsBuffer);
        gl.vertexAttribPointer(this.coords_loc, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(this.normal_loc, 3, gl.FLOAT, false, 0, 0);

        gl.uniformMatrix4fv(this.projection_loc, false, projection);
        gl.uniformMatrix4fv(this.modelview_loc, false, modelview);
        gl.uniformMatrix3fv(this.normalMV_loc, false, normalMV);
        gl.uniformMatrix3fv(this.invMV_loc, false, invMV);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements( gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0 );
    }
}