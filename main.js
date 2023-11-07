///////////////////////////////////////////////////////////
//  A simple WebGL program to show how to load JSON model
//

var gl;
var canvas;
var matrixStack = [];

var zAngle = 0.0;
var yAngle = 0.0;

var prevMouseX = 0;
var prevMouseY = 0;
var aPositionLocation;
var aNormalLocation;
var uVMatrixLocation;
var uMMatrixLocation;
var uPMatrixLocation;



var objVertexPositionBuffer;
var objVertexNormalBuffer;
var objVertexIndexBuffer;

var uDiffuseTermLocation;
var ulightPositionLocation;

var vMatrix = mat4.create(); // view matrix
var mMatrix = mat4.create(); // model matrix
var pMatrix = mat4.create(); //projection matrix

var eyePos = [0.0, 2.0, 3.5];
var lightPosition =  [0.0, 5.0, 2.0];

// Inpur JSON model file to load
input_JSON = "teapot.json";

////////////////////////////////////////////////////////////////////
const vertexShaderCode = `#version 300 es
in vec3 aPosition;

uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;
out vec4 posInEyeSpace;

out mat4 uV, uM;


in vec3 normal;
out vec3 norm;

void main() {
  mat4 projectionModelView;
  norm = normal;
  uV = uVMatrix;
  uM = uMMatrix;

  
  projectionModelView = uPMatrix*uVMatrix*uMMatrix;
  // calculate clip space position
  gl_Position =  projectionModelView * vec4(aPosition,1.0);
  gl_PointSize=3.0;

  posInEyeSpace =   uVMatrix * uMMatrix * vec4(aPosition, 1.0);




}`;

const fragShaderCode = `#version 300 es
precision mediump float;
vec3 lighting;

out vec4 fragColor;
uniform vec4 diffuseTerm;

in mat4 uV, uM;
in vec4 posInEyeSpace;
uniform vec3 lightPosition;

in vec3 norm;



void main() {

  vec3 N = normalize((transpose(inverse(uV*uM))*vec4(norm, 1.0)).xyz);

  
  vec3 lightDir = normalize(lightPosition - posInEyeSpace.xyz);
  

  vec3 viewDir = normalize(posInEyeSpace.xyz);

  vec3 H = normalize(lightDir - viewDir);

  vec3 ambient = vec3(0.0);
  vec3 specular = pow(max(dot(N, H), 0.0), 32.0) * vec3(1.0);
  vec3 diffuse = max(dot(N, lightDir), 0.0) * vec3(1.0);
  lighting = ambient + specular + diffuse;
  fragColor = vec4(diffuseTerm.rgb * lighting, diffuseTerm.a);
}`;




// New sphere initialization function
function initSphere(nslices, nstacks, radius) {
        
    var spVerts = [];
    var spIndicies = [];
    var spNormals = [];

    for (var i = 0; i <= nslices; i++) {
        var angle = (i * Math.PI) / nslices;
        var comp1 = Math.sin(angle);
        var comp2 = Math.cos(angle);

        for (var j = 0; j <= nstacks; j++) {
            var phi = (j * 2 * Math.PI) / nstacks;
            var comp3 = Math.sin(phi);
            var comp4 = Math.cos(phi);

            var xcood = comp4 * comp1;
            var ycoord = comp2;
            var zcoord = comp3 * comp1;

            spVerts.push(radius * xcood, radius * ycoord, radius * zcoord);
            spNormals.push(xcood, ycoord, zcoord);
        }
    }

  // now compute the indices here
  for (var i = 0; i < nslices; i++) {
    for (var j = 0; j < nstacks; j++) {
      var id1 = i * (nstacks + 1) + j;
      var id2 = id1 + nstacks + 1;

      spIndicies.push(id1, id2, id1 + 1);
      spIndicies.push(id2, id2 + 1, id1 + 1);
    }
  }
  return {
    "vertexPositions":spVerts,
    "vertexNormals":spNormals,
    "indices":spIndicies
  };
}

function initSphereBuffer() {
  var nslices = 50;
  var nstacks = 50;
  var radius = 1.0;

  initSphere(nslices, nstacks, radius);

  // buffer for vertices
  spBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spVerts), gl.STATIC_DRAW);
  spBuf.itemSize = 3;
  spBuf.numItems = spVerts.length / 3;

  // buffer for indices
  spIndexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint32Array(spIndicies),
    gl.STATIC_DRAW
  );
  spIndexBuf.itemsize = 1;
  spIndexBuf.numItems = spIndicies.length;

  // buffer for normals
  spNormalBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spNormals), gl.STATIC_DRAW);
  spNormalBuf.itemSize = 3;
  spNormalBuf.numItems = spNormals.length / 3;
}




function vertexShaderSetup(vertexShaderCode) {
  shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(shader, vertexShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function fragmentShaderSetup(fragShaderCode) {
  shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(shader, fragShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function initShaders() {
  shaderProgram = gl.createProgram();

  var vertexShader = vertexShaderSetup(vertexShaderCode);
  var fragmentShader = fragmentShaderSetup(fragShaderCode);

  // attach the shaders
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  //link the shader program
  gl.linkProgram(shaderProgram);

  // check for compilation and linking status
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.log(gl.getShaderInfoLog(vertexShader));
    console.log(gl.getShaderInfoLog(fragmentShader));
  }

  //finally use the program.
  gl.useProgram(shaderProgram);

  return shaderProgram;
}

function initGL(canvas) {
  try {
    gl = canvas.getContext("webgl2"); // the graphics webgl2 context
    gl.viewportWidth = canvas.width; // the width of the canvas
    gl.viewportHeight = canvas.height; // the height
  } catch (e) {}
  if (!gl) {
    alert("WebGL initialization failed");
  }
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function pushMatrix(stack, m) {
  //necessary because javascript only does shallow push
  var copy = mat4.create(m);
  stack.push(copy);
}

function popMatrix(stack) {
  if (stack.length > 0) return stack.pop();
  else console.log("stack has no matrix to pop!");
}

function initObject() {
    objData = initSphere(100, 100, 5.0);
    processObject(objData);
    
    
}

function processObject(objData) {
  objVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexPositionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(objData.vertexPositions),
    gl.STATIC_DRAW
  );
  objVertexPositionBuffer.itemSize = 3;
  objVertexPositionBuffer.numItems = objData.vertexPositions.length / 3;

  objVertexNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexNormalBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(objData.vertexNormals),
    gl.STATIC_DRAW
  );
  objVertexNormalBuffer.itemSize = 3;
  objVertexNormalBuffer.numItems = objData.vertexNormals.length / 3;

  objVertexIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objVertexIndexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint32Array(objData.indices),
    gl.STATIC_DRAW
  );
  objVertexIndexBuffer.itemSize = 1;
  objVertexIndexBuffer.numItems = objData.indices.length;

  drawScene();
}

function drawObject(color) {
  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexPositionBuffer);
  gl.vertexAttribPointer(
    aPositionLocation,
    objVertexPositionBuffer.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexNormalBuffer);
  gl.vertexAttribPointer(
    aNormalLocation,
    objVertexNormalBuffer.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objVertexIndexBuffer);

  gl.uniform4fv(uDiffuseTermLocation, color);
  gl.uniform3fv(ulightPositionLocation, lightPosition);
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

  gl.drawElements(
    gl.TRIANGLES,
    objVertexIndexBuffer.numItems,
    gl.UNSIGNED_INT,
    0
  );
}

//////////////////////////////////////////////////////////////////////
//The main drawing routine
function drawScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //set up the model matrix
  mat4.identity(mMatrix);

  // set up the view matrix, multiply into the modelview matrix
  mat4.identity(vMatrix);
  vMatrix = mat4.lookAt(eyePos, [0, 0, 0], [0, 1, 0], vMatrix);

  //set up projection matrix
  mat4.identity(pMatrix);
  mat4.perspective(60, 1.0, 0.01, 1000, pMatrix);

  mMatrix = mat4.rotate(mMatrix, degToRad(yAngle), [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(zAngle), [0, 1, 0]);

  //draw teapot
  pushMatrix(matrixStack, mMatrix);
  color = [1, 0, 0, 1.0];
  mMatrix = mat4.scale(mMatrix, [0.12, 0.12, 0.12]);
  drawObject(color);
  mMatrix = popMatrix(matrixStack);


  pushMatrix(matrixStack, mMatrix);
  color = [0, 1, 0, 1.0];
  mMatrix = mat4.translate(mMatrix, [1, 0, 0.75])
  mMatrix = mat4.scale(mMatrix, [0.12, 0.12, 0.12]);
  drawObject(color);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  color = [0, 0, 1, 1.0];
  mMatrix = mat4.translate(mMatrix, [-1, 0, 0.75])
  mMatrix = mat4.scale(mMatrix, [0.12, 0.12, 0.12]);
  drawObject(color);
  mMatrix = popMatrix(matrixStack);


  pushMatrix(matrixStack, mMatrix);
  color = [1, 1, 1, 1];
  mMatrix = mat4.translate(mMatrix, [0, -5, 0.5])
  mMatrix = mat4.scale(mMatrix, [0.8, 0.8, 0.8]);
  drawObject(color);
  mMatrix = popMatrix(matrixStack);



}



// This is the entry point from the html
function webGLStart() {
  canvas = document.getElementById("simpleLoadObjMesh");

  initGL(canvas);

  gl.enable(gl.DEPTH_TEST);

  gl.enable(gl.SCISSOR_TEST);

  shaderProgram = initShaders();

  gl.enable(gl.DEPTH_TEST);

  
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clearColor(0, 0, 0, 1.0);

  //get locations of attributes declared in the vertex shader
  aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
  aNormalLocation = gl.getAttribLocation(shaderProgram, "normal");
  uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
  uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
  uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
  uDiffuseTermLocation = gl.getUniformLocation(shaderProgram, "diffuseTerm");
  ulightPositionLocation = gl.getUniformLocation(shaderProgram, "lightPosition");

  //enable the attribute arrays
  gl.enableVertexAttribArray(aPositionLocation);
  gl.enableVertexAttribArray(aNormalLocation);

  //initialize buffers for the square
  initObject();
}
