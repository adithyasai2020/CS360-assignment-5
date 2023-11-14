const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl');


var lightPosition = [0.0, 9.5, 8.0];
var bounceLimit = 2;
var needReflection = 0.0;

if (!gl) {
    console.error('WebGL is not supported in your browser');
}

// Shader sources

const vertexShaderSource1 = `
attribute vec2 vPosition;
varying vec2 fPosition;

void main() {
            fPosition = vPosition;
            gl_Position = vec4(vPosition, 0.0, 1.0);
}
`;

const fragmentShaderSource1 = `
precision highp float;
        varying vec2 fPosition;
        uniform vec3 lightPosition;

        const int maxObjs = 10;
        const int maxReflections = 10000;

        float alpha = 0.5;
        uniform float reflections;
        uniform float needReflection;
        float focalLength = 2.0;


        struct Sphere {
            vec3 center;
            float radius;
            vec3 color;
            float reflectivity;
        };

        struct Plane {
            vec3 point;
            vec3 normal;
            vec3 color;
            float reflectivity;
        };

        struct Ray {
            vec3 origin;
            vec3 direction;
            float intensity;
        };

        struct Light {
            vec3 position;
            vec3 ambient, diffuse, specular;
        };

        struct RayTracerOutput {
            Ray reflectedRay;
            vec3 color;
        };

        Light light;
        Sphere spheres[maxObjs];
        Plane planes[maxObjs];
        int numSpheres = 0, numPlanes = 0;


        const float PI = 3.14159265358979323846264;


        // Initialization function for image 1
        void init1() {
            // light.position = vec3(10.0, 9.5, 0.0);
            light.position = vec3(lightPosition);
            numSpheres = 4;
            numPlanes = 0;

            vec4 origin = vec4(0.0, 0.0, 0.0, 1.0);
            vec3 mainOrbitOffset = vec3(0.0, 0.6, 0.0);

            spheres[0].color = vec3(1.0, 0.0, 0.0);
            spheres[0].reflectivity = 1.0;
            spheres[0].center =  vec3(0.0, 0.0, 0.0);
            spheres[0].radius = 0.4;

            spheres[1].color = vec3(0.0, 0.8, 0.0);
            spheres[1].reflectivity = 1.0;
            spheres[1].center = vec3(-0.5, 0.0, 0.6);
            spheres[1].radius = 0.3;

            spheres[2].color = vec3(0.0, 0.0, 1.0);
            spheres[2].reflectivity = 1.0;
            spheres[2].center = vec3(0.5, 0.0, 0.6);
            spheres[2].radius = 0.3;

            spheres[3].color = vec3(0.7);
            spheres[3].reflectivity = 0.9;
            spheres[3].center = vec3(0.0, -4.0, 0.0);
            spheres[3].radius = 3.5;

            
        }

        // Initializes the objects in the world
        void initWorld() {
            light.ambient = vec3(0.2, 0.2, 0.2);
            light.diffuse = vec3(0.8, 0.8, 0.8);
            light.specular = vec3(0.95, 0.95, 0.95);

            init1();
        }


        // Checks if the specified ray intersects the specified sphere
        float checkIntersectSphere(Sphere sphere, Ray ray) {
            vec3 sphereCenter = sphere.center;
            float radius = sphere.radius;
            vec3 cameraSource = ray.origin;
            vec3 cameraDirection = ray.direction;

            vec3 distanceFromCenter = (cameraSource - sphereCenter);
            float B = 2.0 * dot(cameraDirection, distanceFromCenter);
            float C = dot(distanceFromCenter, distanceFromCenter) - pow(radius, 2.0);
            float delta = pow(B, 2.0) - 4.0 * C;
            float t = 0.0;
            if (delta > 0.0) {
                float sqRoot = sqrt(delta);
                float t1 = (-B + sqRoot) / 2.0;
                float t2 = (-B - sqRoot) / 2.0;
                t = min(t1, t2);
            }
            if (delta == 0.0) {
                t = -B / 2.0;
            }
            return t;
        }

        // Checks if the specified ray intersects the specified plane
        float checkIntersectPlane(Plane plane, Ray ray) {
            float numerator = dot(plane.point - ray.origin, plane.normal);
            float denominator = dot(ray.direction, plane.normal);
            if (denominator == 0.0) return 0.0;
            return 0.0;
            // return numerator / denominator;
        }

        // Checks to see if a ray intersects a world object before the light
        // Used for the shadow ray
        bool intersectsBeforeLight(Ray ray) {
            float distanceToLight = distance(ray.origin, light.position);

            // Spheres
            for (int i = 0; i < maxObjs; i++) {
                if (i >= numSpheres) break;
                float t = checkIntersectSphere(spheres[i], ray);
                if (t > 0.0 && t < distanceToLight) {
                    return true;
                }
            }

            // Planes
            for (int i = 0; i < maxObjs; i++) {
                if (i >= numPlanes) break;
                float t = checkIntersectPlane(planes[i], ray);
                if (t > 0.0 && t < distanceToLight) {
                    return true;
                }
            }

            return false;
        }


        // Traces a ray through the world
        // Returns a reflection ray and a calculated color
        RayTracerOutput traceRay(Ray ray) {

            // Conduct intersection testing
            float minT = 100000.0;
            int typeToShow = 0; // 0 for nothing, 1 for sphere, 2 for plane
            Sphere sphere;
            Plane plane;

            // Sphere intersection testing
            for (int i = 0; i < maxObjs; i++) {
                if (i >= numSpheres) break;
                float t = checkIntersectSphere(spheres[i], ray);
                if (t > 0.0 && t < minT) {
                    minT = t;
                    sphere = spheres[i];
                    typeToShow = 1;
                }
            }

            // Plane intersection testing
            for (int i = 0; i < maxObjs; i++) {
                if (i >= numPlanes) break;
                float t = checkIntersectPlane(planes[i], ray);
                if (t > 0.0 && t < minT) {
                    minT = t;
                    plane = planes[i];
                    typeToShow = 2;
                }
            }

            // Calculate ray color & reflection
            RayTracerOutput rayTracer;
            vec3 color = vec3(0.0, 0.0, 0.0);
            if (typeToShow > 0) {

                // Get variables from the intersected object
                vec3 surfacePoint = ray.origin + (minT * ray.direction);
                vec3 surfaceNormal;
                vec3 objColor;
                float reflectivity;
                if (typeToShow == 1) {
                    surfaceNormal = normalize(surfacePoint - sphere.center);
                    objColor = sphere.color;
                    reflectivity = sphere.reflectivity;
                } else if (typeToShow == 2) {
                    surfaceNormal = plane.normal;
                    objColor = plane.color;
                    reflectivity = plane.reflectivity;
                }

                // Ambient light
                color += light.ambient * objColor;

                // Shadow check
                // Only show diffuse + specular if we are not in shadow
                vec3 L = normalize(light.position - surfacePoint);
                Ray shadowRay;
                shadowRay.origin = surfacePoint + 0.00001 * L;
                shadowRay.direction = L;
                if (!intersectsBeforeLight(shadowRay)) {
                    vec3 N = surfaceNormal;

                    // Diffuse light
                    color += light.diffuse * objColor * max(0.0, dot(L, N));

                    // Specular light
                    float shininess = 20.0;
                    vec3 R = reflect(-L, N);
                    vec3 C = normalize(ray.origin - surfacePoint);
                    float specular = pow(max(dot(R, C), 0.0), shininess);
                    color += light.specular * specular * reflectivity;
                }

                //Reflection ray
                if(needReflection > 0.0){
                    Ray reflectionRay;
                    vec3 reflection = reflect(ray.direction, surfaceNormal);
                    reflectionRay.origin = surfacePoint + 0.00001 * reflection;
                    reflectionRay.direction = reflection;
                    reflectionRay.intensity = ray.intensity * reflectivity;
                    rayTracer.reflectedRay = reflectionRay;

                }
                
            }
            rayTracer.color = color * ray.intensity;

            return rayTracer;
        }


        void main() {

            // Initialize the world objects
            initWorld();

            // Create the first ray
            Ray currRay;
            currRay.origin = vec3(0.0, 0.0, focalLength);
            currRay.direction = normalize(vec3(fPosition, -focalLength));
            currRay.intensity = 1.0;

            // Calculate the final color
            vec3 color = vec3(0.0, 0.0, 0.0);
            for (int i = 0; i <= maxReflections; i++) {
                if (i >= int(reflections)) break;
                RayTracerOutput rayTracer = traceRay(currRay);
                color += rayTracer.color;
                currRay = rayTracer.reflectedRay;
            }
            gl_FragColor = vec4(color, 1.0);
        }
`;


function flatten( v )
{
    if ( v.matrix === true ) {
        v = transpose( v );
    }

    var n = v.length;
    var elemsAreArrays = false;

    if ( Array.isArray(v[0]) ) {
        elemsAreArrays = true;
        n *= v[0].length;
    }

    var floats = new Float32Array( n );

    if ( elemsAreArrays ) {
        var idx = 0;
        for ( var i = 0; i < v.length; ++i ) {
            for ( var j = 0; j < v[i].length; ++j ) {
                floats[idx++] = v[i][j];
            }
        }
    }
    else {
        for ( var i = 0; i < v.length; ++i ) {
            floats[i] = v[i];
        }
    }

    return floats;
}

const glBounds = [
    -1, 1,  // Upper left
    1, 1,   // Upper right
    -1, -1, // Lower left
    1, -1,  // Lower right
];
// Compile shaders and create program
const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource1);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource1);
const program = createProgram(gl, vertexShader, fragmentShader);

// Find attribute and uniform locations
// const positionLocation = gl.getAttribLocation(program, 'a_position');
// const foregroundLocation = gl.getUniformLocation(program, 'u_foreground');
// const backgroundLocation = gl.getUniformLocation(program, 'u_background');
// const alphaLocation = gl.getUniformLocation(program, "alpha");
// const greyOrSepiaLocation = gl.getUniformLocation(program, "greyOrSepia");
// const contrastLocation = gl.getUniformLocation(program, "contrast");
// const brightnessLocation = gl.getUniformLocation(program, "brightness");
// const shapeLocation = gl.getUniformLocation(program, "shape");
// const kernelLocation = gl.getUniformLocation(program, "kernel");
const lightPositionLocation = gl.getUniformLocation(program, 'lightPosition');
const bounceLimitLocation = gl.getUniformLocation(program, "reflections");
const needReflectLocation = gl.getUniformLocation(program, "needReflection");

// Create buffer for a square
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

const vPosBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vPosBuffer);
gl.bufferData(gl.ARRAY_BUFFER, flatten(glBounds), gl.STATIC_DRAW);
const pos = gl.getAttribLocation(program, 'vPosition');
gl.enableVertexAttribArray(pos);
gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

// // Create texture objects
// const foregroundTexture = createTexture(gl);
// const backgroundTexture = createTexture(gl);

// // Handle file uploads
// document.getElementById('foregroundImage').addEventListener('change', handleForegroundUpload);
// document.getElementById('backgroundImage').addEventListener('change', handleBackgroundUpload);

// function handleForegroundUpload(event) {
//     loadTexture(gl, foregroundTexture, event.target.files[0], foregroundLocation);
// }

// function handleBackgroundUpload(event) {
//     loadTexture(gl, backgroundTexture, event.target.files[0], backgroundLocation);
// }

// Render function
function render() {

    canvas.width = 400; // Set the initial canvas size
    canvas.height = 400;    
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    // gl.enableVertexAttribArray(positionLocation);
    // gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // gl.activeTexture(gl.TEXTURE0);
    // gl.bindTexture(gl.TEXTURE_2D, foregroundTexture);
    // gl.uniform1i(foregroundLocation, 0);
    
    gl.uniform3fv(lightPositionLocation, lightPosition);
    gl.uniform1f(bounceLimitLocation, bounceLimit);
    gl.uniform1f(needReflectLocation, needReflection);
    // gl.uniform1f(alphaLocation, 0.0);
    
    // var to_send = 0.0;
    // gl.uniform1f(greyOrSepiaLocation, to_send);

    // gl.uniform1f(contrastLocation, contrastValue);
    // gl.uniform1f(brightnessLocation, brightnessValue);
    // gl.uniform2f(shapeLocation, canvas.width*1.0, canvas.height*1.0);
    // if(isSmooth){
    //     gl.uniformMatrix3fv(kernelLocation, false, [
    //         1.0, 1.0, 1.0,
    //         1.0, 1.0, 1.0,
    //         1.0, 1.0, 1.0
    //       ].map(function(item) { return item/9.0 } ));

    // }
    // else if(isSharpen){
    //     gl.uniformMatrix3fv(kernelLocation, false, [
    //         0.0, -1.0, 0.0,
    //         -1.0, 5.0, -1.0,
    //         0.0, -1.0, 0.0
    //       ]);
    // }
    // else if(isGradient){
    //     gl.uniformMatrix3fv(kernelLocation, false, [
    //         0.0, 0.0, 0.0,
    //         0.0, 2.0, 0.0,
    //         0.0, 0.0, 0.0
    //       ]);
    // }
    // else if(isLaplacian){
    //     gl.uniformMatrix3fv(kernelLocation, false, [
    //         0.0, -1.0, 0.0,
    //         -1.0, 4.0, -1.0,
    //         0.0, -1.0, 0.0
    //       ]);
    // }
    // else{
    //     gl.uniformMatrix3fv(kernelLocation, false, [
    //         0.0, 0.0, 0.0,
    //         0.0, 1.0, 0.0,
    //         0.0, 0.0, 0.0
    //       ]);
        
    // }
    // gl.activeTexture(gl.TEXTURE1);
    // gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
    // gl.uniform1i(backgroundLocation, 1);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}


// Utility functions for WebGL
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
        return null;
    }

    return program;
}

// function createTexture(gl) {
//     const texture = gl.createTexture();
//     gl.bindTexture(gl.TEXTURE_2D, texture);

//     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
//     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
//     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
//     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

//     return texture;
// }

// function loadTexture(gl, texture, file, location) {
//     const image = new Image();
//     image.src = URL.createObjectURL(file);

//     image.onload = function () {

        
//         gl.bindTexture(gl.TEXTURE_2D, texture);
//         gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
//         render();
//     };
// }



// // Add event listeners to listen for changes
// contrastSlider.addEventListener("input", function() {
//     contrastValue = parseFloat(contrastSlider.value);
//     // You can perform the necessary updates or actions here
//     console.log("Contrast ", contrastValue);
//     render();
// });

// brightnessSlider.addEventListener("input", function() {
//     brightnessValue = parseFloat(brightnessSlider.value);
//     // You can perform the necessary updates or actions here
//     console.log("Brightness ", brightnessValue);
//     render();
// });

// grayscaleCheckbox.addEventListener("change", function() {
//     isGrayscale = grayscaleCheckbox.checked;
//     if(isGrayscale){
//         sepiaCheckbox.checked = false;
//         isSepia = false;
        
//     }
//     // You can perform the necessary updates or actions here
    
//     render();
//     console.log("grayscale", isGrayscale);
// });

// sepiaCheckbox.addEventListener("change", function() {
//     isSepia = sepiaCheckbox.checked;
//     if(isSepia){
//         grayscaleCheckbox.checked = false;
//         isGrayscale = false;
        
//     }
    
//     render();
//     console.log("Sepia", isSepia);
//     // You can perform the necessary updates or actions here
// });
// // Add event listeners to listen for changes
// backgroundRadio.addEventListener("change", function() {
//     if (backgroundRadio.checked) {
//         selectedMode = "background";
//         console.log(selectedMode);
//         // You can perform the necessary updates or actions here
//     }
//     render();
// });

// alphaBlendedRadio.addEventListener("change", function() {
//     if (alphaBlendedRadio.checked) {
//         selectedMode = "alpha-blended";
//         console.log(selectedMode);
//         // You can perform the necessary updates or actions here
//     }
//     render();
// });

// smoothCheckbox.addEventListener("change", function(){
//     isSmooth = smoothCheckbox.checked;
//     if(isSmooth){

//         sharpenCheckbox.checked = false;
//         gradientCheckbox.checked = false;
//         laplacianCheckbox.checked = false;

//         isSharpen = false;
//         isGradient = false;
//         isLaplacian = false;

//     }
//     render();
//     console.log("Smoothen", isSmooth);

// });

// sharpenCheckbox.addEventListener("change", function(){
//     isSharpen = sharpenCheckbox.checked;

//     if(isSharpen){

//         smoothCheckbox.checked = false;
//         gradientCheckbox.checked = false;
//         laplacianCheckbox.checked = false;
//         isSmooth = false;
//         isGradient = false;
//         isLaplacian = false;

//     }
//     render();

//     console.log("Sharpen", isSharpen);

// });

// gradientCheckbox.addEventListener("change", function(){
//     isGradient = gradientCheckbox.checked;
//     if(isGradient){

//         smoothCheckbox.checked = false;
//         sharpenCheckbox.checked = false;
//         laplacianCheckbox.checked = false;

//         isSmooth = false;
//         isSharpen = false;
//         isLaplacian = false;

//     }
//     render();
//     console.log("Gradient", isGradient);

// });

// laplacianCheckbox.addEventListener("change", function(){
//     isLaplacian = laplacianCheckbox.checked;
//     if(isLaplacian){

//         smoothCheckbox.checked = false;
//         sharpenCheckbox.checked = false;
//         gradientCheckbox.checked = false;

//         isSmooth = false;
//         isSharpen = false;
//         isGradient = false;

//     }
//     render();
//     console.log("Laplacian", isLaplacian);

// });

// resetButton.addEventListener("click", () => {
//     // Reset all radio buttons by unchecking them
//     radioButtons.forEach((radio) => {
//       radio.checked = false;
//     });
//      radioButtons[0].checked = true;
//      selectedMode = "background";
    
//     // Reset all checkboxes by unchecking them
//     checkboxes.forEach((checkbox) => {
//       checkbox.checked = false;
//     });
    
//     isSmooth = false;
//     isSharpen = false;
//     isGradient = false;
//     isLaplacian = false;
//     isGrayscale = false;
//     isSepia = false;
//     // Reset sliders to their default values
//     contrastSlider.value = 0.5; // Set the default value for the contrast slider
//     brightnessSlider.value = 0.0; // Set the default value for the brightness slider
//     render();
// });


// const saveButton = document.getElementById('saveScreenshot');
// const downloadLink = document.getElementById('downloadLink');
// saveButton.addEventListener('click', () => {
//   canvas.toBlob((blob) => {
//     saveBlob(blob, `screencapture-${canvas.width}x${canvas.height}.jpg`);
//   });
// });
 
// const saveBlob = (function() {
//   const a = document.createElement('a');
//   document.body.appendChild(a);
//   a.style.display = 'none';
//   return function saveData(blob, fileName) {
//      const url = window.URL.createObjectURL(blob);
//      a.href = url;
//      a.download = fileName;
//      a.click();
//   };
// // }());
// const saveScreenshotButton = document.getElementById("saveScreenshot");

// // Add a click event listener to the button
// saveScreenshotButton.addEventListener("click", saveScreenshot);
// function saveScreenshot() {
//     render();
//     // Get the canvas element by its ID
//     const canvas = document.getElementById("canvas");

//     // Create an "a" element to trigger the download
//     const a = document.createElement("a");

//     // Convert the canvas content to a data URL with JPEG format
//     const dataURL = canvas.toDataURL("image/jpeg");

//     // Set the "href" attribute of the "a" element to the data URL
//     a.href = dataURL;

//     // Set the "download" attribute and file name
//     a.download = "screenshot.jpg";

//     // Trigger a click event on the "a" element to start the download
//     a.click();
// }

// // Start rendering loop


render();

const p = document.getElementById("phong");
const ps = document.getElementById("phong-shadow");
const pr = document.getElementById("phong-reflection");
const psr = document.getElementById("phong-shadow-reflection");


p.addEventListener("click", function() {
    console.log("phong");
    needReflection = 0.0
    render();
  });
  ps.addEventListener("click", function() {
    console.log("phong-shadow");
    needReflection = 0.0
    render();
  });
  pr.addEventListener("click", function() {
    console.log("phong-reflection");
    needReflection = 1.0
    render();
  });
  psr.addEventListener("click", function() {
    console.log("phong-shadow-reflection");
    needReflection = 1.0
    render();
  });

  // Get a reference to the "Button 1" element by its ID

  // Get references to the "Move Light" and "Bounce Limit" sliders and their associated value display elements by their IDs
    const moveLightSlider = document.getElementById("moveLight");
    const moveLightValue = document.getElementById("moveLightValue");
    const bounceLimitSlider = document.getElementById("bounceLimit");
    const bounceLimitValue = document.getElementById("bounceLimitValue");

    // Add event listeners to the sliders to track value changes
    moveLightSlider.addEventListener("input", function() {
        // Execute JavaScript commands when the "Move Light" slider value changes
        const value = moveLightSlider.value;
        // Update the value display element
        moveLightValue.textContent = value;
        lightPosition[0] = value;
        render();
        
        // Add your custom logic here, using the updated slider value
        // For example, you can update a 3D scene based on the "Move Light" slider value.
    });

    bounceLimitSlider.addEventListener("input", function() {
        // Execute JavaScript commands when the "Bounce Limit" slider value changes
        const value = bounceLimitSlider.value;
        bounceLimit = value
        bounceLimitValue.textContent = value;
        render();
        
        // Add your custom logic here, using the updated slider value
        // For example, you can adjust a physics simulation based on the "Bounce Limit" slider value.
    });