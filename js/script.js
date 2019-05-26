        const fragment = `
            #define PI 3.14159265359
            uniform vec2 u_resolution;

            uniform sampler2D u_texture;
            uniform sampler2D u_texture2;
            uniform vec2 u_textureFactor;
            uniform vec2 u_texture2Factor;
            uniform float u_textureProgress;
            uniform float u_progress;
            uniform float u_progress_txt;
            uniform float u_time;

            // RGB
            uniform vec2 u_rgbPosition;
            uniform vec2 u_rgbVelocity;

            varying vec2 vUv;
            vec2 centeredAspectRatio(vec2 uvs, vec2 factor){
                return uvs * factor - factor /2. + 0.5;
            }
            void main(){
                float u_ratio = u_resolution.x/u_resolution.y;


                vec2 normalizedRgbPos = u_rgbPosition / u_resolution;
                normalizedRgbPos.y = 1. - normalizedRgbPos.y; 
                
                vec2 vel = u_rgbVelocity;
                float dist = distance(vec2(normalizedRgbPos.x,normalizedRgbPos.y/u_ratio) + vel / u_resolution, vec2(vUv.x,vUv.y/u_ratio));

                float ratio = clamp(1.0 - dist * 10., 0., 1.);


                vec4 tex1 = vec4(1.);
                vec4 tex2 = vec4(1.);

                vec2 uv = vUv;
                vec2 uv1 = vUv;
                //uv.x += u_progress_txt;
                //uv1.x += u_progress_txt-1.;

                uv.x -= sin(uv.y) * ratio / 100. * (vel.x + vel.y) / 7.;
                uv.y -= sin(uv.x) * ratio / 100. * (vel.x + vel.y) / 7.;

                tex1.r = texture2D(u_texture, centeredAspectRatio(uv, u_textureFactor )).r;
                tex2.r = texture2D(u_texture2, centeredAspectRatio(uv1, u_texture2Factor)).r;

                
                uv.x -= sin(uv.y) * ratio / 150. * (vel.x + vel.y) / 7.;
                uv.y -= sin(uv.x) * ratio / 150. * (vel.x + vel.y) / 7.;

                tex1.g = texture2D(u_texture, centeredAspectRatio(uv, u_textureFactor )).g;
                tex2.g = texture2D(u_texture2, centeredAspectRatio(uv1, u_texture2Factor )).g;
                
                uv.x -= sin(uv.y) * ratio / 300. * (vel.x + vel.y) / 7.;
                uv.y -= sin(uv.x) * ratio / 300. * (vel.x + vel.y) / 7.;

                tex1.b = texture2D(u_texture, centeredAspectRatio(uv, u_textureFactor )).b;
                tex2.b = texture2D(u_texture2, centeredAspectRatio(uv1, u_texture2Factor )).b;

                //vec4 fulltex1 = texture2D(u_texture, centeredAspectRatio(vUv, u_textureFactor) );
                //vec4 fulltex2 = texture2D(u_texture2, centeredAspectRatio(vUv, u_texture2Factor));
                

                vec4 mixedTextures =  mix(tex1,tex2,u_progress_txt);
                
                gl_FragColor = mixedTextures;
            }
            `;

        const vertex = `
            #define PI 3.14159265359
            uniform float u_offset;
            uniform float u_progress;
            uniform float u_direction;
            uniform float u_time;
            uniform float u_waveIntensity;
            uniform vec2 u_resolution;
            varying vec2 vUv;
            void main(){
                vec3 pos = position.xyz;
                
                float progressY = pos.y/u_resolution.y;

                //pos.z -= u_offset * u_progress;
                
                pos.z -= (u_progress/3.)*(sin(PI*(mod(pos.y*3.,2.)/2.)+(2.*pos.x+2.*u_time/3.))+PI/2.);

                
                gl_Position =   
                    projectionMatrix * 
                    modelViewMatrix * 
                     vec4(pos, 1.0);

                vUv = uv;
            }
        `;

        function GLManager(data) {
          this.totalEntries = data.length;
          this.loadedEntries = 0;
          const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
          camera.position.z = 5;

          const scene = new THREE.Scene();
          camera.lookAt = scene.position;

          const renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true
          });
          renderer.setSize(window.innerWidth, window.innerHeight);
          renderer.setPixelRatio(window.devicePixelRatio);

          this.render = this.render.bind(this);
          this.textures = data.map((entry, i) =>
            new THREE.TextureLoader().load(
              entry.image,
              this.calculateAspectRatioFactor.bind(this, i)
            )
          );
          this.factors = data.map(d => new THREE.Vector2(1, 1));
          this.currentIndex = 0;
          this.nextIndex = 0;
          this.textureProgress = 0;
          this.camera = camera;
          this.scene = scene;
          this.renderer = renderer;
          this.initialRender = false;
          this.time = 0;
          this.loopRaf = null;
          this.loop = this.loop.bind(this);
          this.renderLoop = this.renderLoop.bind(this);
          this.animate = false;

          this.textureTween = null;
          this.zoomTween = null;
        }
        GLManager.prototype.getViewSize = function () {
          const fovInRadians = (this.camera.fov * Math.PI) / 180;
          const viewSize = Math.abs(
            this.camera.position.z * Math.tan(fovInRadians / 2) * 2
          );

          return viewSize;
        };

        GLManager.prototype.getPlaneSize = function () {
          const viewSize = this.getViewSize();
          return {
            width: viewSize*1.2,
            height: viewSize
          };
        };
        GLManager.prototype.calculateAspectRatioFactor = function (index, texture) {
          const plane = this.getPlaneSize();
          const windowRatio = window.innerWidth / window.innerHeight;
          const rectRatio = (plane.width / plane.height) * windowRatio;
          const imageRatio = texture.image.width / texture.image.height;

          let factorX = 1;
          let factorY = 1;
          if (rectRatio > imageRatio) {
            factorX = 1;
            factorY = (1 / rectRatio) * imageRatio;
          } else {
            factorX = (1 * rectRatio) / imageRatio;
            factorY = 1;
          }

          this.factors[index] = new THREE.Vector2(factorX, factorY);
          if (this.currentIndex === index) {
            this.mesh.material.uniforms.u_textureFactor.value = this.factors[index];
            this.mesh.material.uniforms.u_textureFactor.needsUpdate = true;
          }
          if (this.nextIndex === index) {
            this.mesh.material.uniforms.u_texture2Factor.value = this.factors[index];
            this.mesh.material.uniforms.u_texture2Factor.needsUpdate = true;
          }
          if (this.initialRender) {
            this.loadedEntries++;
            if (this.loadedEntries === this.totalEntries) {
              document.body.classList.remove('loading');
            }
            this.render();
          }
        };
        // Plane Stuff
        GLManager.prototype.createPlane = function () {
          // Calculate bas of Isoceles triangle(camera)
          const viewSize = this.getViewSize();
          const {
            width,
            height
          } = this.getPlaneSize();

          const segments = 60;
          const geometry = new THREE.PlaneBufferGeometry(
            width,
            height,
            segments,
            segments
          );
          const material = new THREE.ShaderMaterial({
            uniforms: {
              u_texture: {
                type: "t",
                value: this.textures[this.currentIndex]
              },
              u_textureFactor: {
                type: "f",
                value: this.factors[this.currentIndex]
              },
              u_texture2: {
                type: "t",
                value: this.textures[this.nextIndex]
              },
              u_texture2Factor: {
                type: "f",
                value: this.factors[this.nextIndex]
              },
              u_textureProgress: {
                type: "f",
                value: this.textureProgress
              },
              u_offset: {
                type: "f",
                value: 8
              },
              u_progress: {
                type: "f",
                value: 0
              },
              u_progress_txt: {
                type: "f",
                value: 0
              },
              u_direction: {
                type: "f",
                value: 1
              },
              u_effect: {
                type: "f",
                value: 0
              },
              u_time: {
                type: "f",
                value: this.time
              },
              u_waveIntensity: {
                type: "f",
                value: 0
              },
              u_resolution: {
                type: "v2",
                value: new THREE.Vector2(window.innerWidth, window.innerHeight)
              },
              u_rgbPosition: {
                type: "v2",
                value: new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2)
              },
              u_rgbVelocity: {
                type: "v2",
                value: new THREE.Vector2(0, 0)
              }
            },
            vertexShader: vertex,
            fragmentShader: fragment,
            side: THREE.DoubleSide
          });
          const mesh = new THREE.Mesh(geometry, material);
          this.scene.add(mesh);
          this.mesh = mesh;
        };
        GLManager.prototype.changeTexture = function(newIndex){
          this.animate = true;
          //this.currentIndex = this.nextIndex;
          this.nextIndex = newIndex;
          //this.mesh.material.uniforms.u_texture.value = this.textures[this.currentIndex];
          //this.mesh.material.uniforms.u_textureFactor.value = this.factors[this.currentIndex];
          this.mesh.material.uniforms.u_texture2.value = this.textures[newIndex];
          this.mesh.material.uniforms.u_texture2Factor.value = this.factors[newIndex];
          this.textureProgress = 0;

          let that = this;
          TweenLite.to(that.mesh.material.uniforms.u_progress_txt, 1.5 , {
            value: 1.,
            ease: Power1.easeOut,
            overwrite: 1,
            onComplete: function(){
                that.mesh.material.uniforms.u_progress_txt.value = 0.;
            }
          });
          this.zoomTween = TweenLite.to(that.mesh.material.uniforms.u_progress, 0.5 , {
            value: 1.,
            ease: Power1.easeOut,
            overwrite: 1,
            onComplete: function(){
              that.textureTween = TweenLite.to(that.mesh.material.uniforms.u_textureProgress, 0.5 , {
                value: 1.,
                overwrite: 1,
                onComplete: function(){
                  that.mesh.material.uniforms.u_texture.value = that.textures[that.nextIndex];
                  that.mesh.material.uniforms.u_textureFactor.value = that.factors[that.nextIndex];
                  that.mesh.material.uniforms.u_textureProgress.value = 0.;
                  that.zoomTween = TweenLite.to(that.mesh.material.uniforms.u_progress, 0.5 , {
                    value: 0.,
                    ease: Power1.easeOut,
                    overwrite: 1,
                    onComplete: function(){
                      that.animate = false;
                    }                       
                  });
                }    
              });
            }                            
          });

        };

        GLManager.prototype.updateTexture = function (newIndex) {
          let didChange = false;
          if (newIndex != null && this.newIndex !== this.currentIndex) {
            this.currentIndex = this.nextIndex;
            this.nextIndex = newIndex;
            this.mesh.material.uniforms.u_texture.value = this.textures[this.currentIndex];
            this.mesh.material.uniforms.u_textureFactor.value = this.factors[this.currentIndex];
            this.mesh.material.uniforms.u_texture2.value = this.textures[newIndex];
            this.mesh.material.uniforms.u_texture2Factor.value = this.factors[newIndex];
            this.textureProgress = 0;

            TweenMax.to(this.mesh.material.uniforms.u_textureProgress, 1 , {
              value: 1.
            });

            didChange = true;
          }

          if (!this.loopRaf && didChange) {
            this.render();
          }
        };
        GLManager.prototype.zoomOut = function () {
          let that = this;
          TweenMax.to(that.mesh.material.uniforms.u_progress, 0.5 , {
            value: 1.,
            ease: Power1.easeOut,
            overwrite: "all",
            onComplete: function(){
              TweenMax.to(that.mesh.material.uniforms.u_progress, 0.5 , {
                value: 0.,
                ease: Power1.easeOut,
                overwrite: "all",                        
              });
            }                            
          });

/*          this.mesh.material.uniforms.u_progress.value = progress;
          this.mesh.material.uniforms.u_direction.value = direction;
          this.mesh.material.uniforms.u_waveIntensity.value = waveIntensity;*/
        };

        GLManager.prototype.updateRgbEffect = function (
          position,
          velocity
        ) {
          this.mesh.material.uniforms.u_rgbPosition.value = new THREE.Vector2(
            position.x,
            position.y
          );
          this.mesh.material.uniforms.u_rgbVelocity.value = new THREE.Vector2(
            velocity.x,
            velocity.y
          );
          if (!this.loopRaf) {
            this.render();
          }
        };
        GLManager.prototype.updateRgbEffectX = function(pos,vel){
             this.mesh.material.uniforms.u_rgbPosition.value.x = pos;
             this.mesh.material.uniforms.u_rgbVelocity.value.x = vel;
        }
        GLManager.prototype.updateRgbEffectY = function(pos,vel){
             this.mesh.material.uniforms.u_rgbPosition.value.y = pos;
             this.mesh.material.uniforms.u_rgbVelocity.value.y = vel;
        }
        // Other stuff
        GLManager.prototype.render = function () {
          //console.log('render');
          this.renderer.render(this.scene, this.camera);
        };
        GLManager.prototype.mount = function (container) {
          container.appendChild(this.renderer.domElement);
          this.loop();
        };
        GLManager.prototype.unmount = function () {
          this.mesh.material.dispose();
          this.mesh.geometry.dispose();
          this.mesh = null;
          this.renderer = null;
          this.camera = null;
          this.scene = null;
          this.container = null;
        };
        GLManager.prototype.onResize = function () {
          this.renderer.setSize(window.innerWidth, window.innerHeight);
          this.mesh.material.uniforms.u_resolution.value = new THREE.Vector2(
            window.innerWidth,
            window.innerHeight
          );
          for (var i = 0; i < this.textures.length; i++) {
            if (this.textures[i].image) {
              this.calculateAspectRatioFactor(i, this.textures[i]);
            }
          }

          this.render();
        };

        GLManager.prototype.loop = function () {
          this.render();
          this.time += 0.1;
          this.mesh.material.uniforms.u_time.value = this.time;
          this.loopRaf = requestAnimationFrame(this.loop)
        };

        GLManager.prototype.renderLoop = function () {
          if(this.animate){
            this.render();
          }
          requestAnimationFrame(this.renderLoop);
        };

        GLManager.prototype.cancelLoop = function () {
          cancelAnimationFrame(this.loopRaf);
          this.loopRaf = null;
        };        

        

        const reach = function ({
          from,
          to,
          restDelta = 0.01
        }) {
          let current = Object.assign({}, from);
          let keys = Object.keys(from);

          let raf = {
            current: null
          };

          let _update = function (update, complete) {
            if (keys.length === 0) {
              cancelAnimationFrame(raf.current);
              raf.current = null;

              complete(current);
              return;
            }

            let cacheKeys = keys.slice();

            for (var i = keys.length, val, key; i >= 0; i--) {
              key = keys[i];
              val = current[key] + (to[key] - current[key]) * 0.1;
              if (Math.abs(to[key] - val) < restDelta) {
                current[key] = to[key];
                // Remove key
                keys.splice(i, 1);
                // Move i down by pne
                i--;
              } else {
                current[key] = val;
              }
            }

            update(current);
            raf.current = requestAnimationFrame(_update);
          };
          return {
            start: function ({
              update,
              complete
            }) {
              _update = _update.bind(null, update, complete);
              raf.current = requestAnimationFrame(_update);
              return {
                stop: function () {
                  cancelAnimationFrame(raf.current);
                  raf.current = null;
                }
              };
            }
          };
        };

        function Showcase(data, options = {}) {
          this.GL = new GLManager(data);
          this.GL.createPlane();

          this.data = data;

          this.progress = 0;
          this.direction = 1;
          this.waveIntensity = 0;

          this.options = options;

          this.slidesNum = data.length;
          this.active = 0;

          this.follower = {
            x: 0,
            y: 0
          };

          this.followerSpring = null;

          this.slidesSpring = null;
        }

        Showcase.prototype.mount = function (container) {
          this.GL.mount(container);
        };
        Showcase.prototype.render = function () {
          this.GL.render();
        };

        Showcase.prototype.onMouseMove = function (ev) {
          this.GL.updateRgbEffect({x:0,y:0},{x:0,y:0});
        };
        Showcase.prototype.onMouseMoveX = function (pos,vel) {
            this.GL.updateRgbEffectX(pos,vel);
        };
        Showcase.prototype.onMouseMoveY = function (pos,vel) {
            this.GL.updateRgbEffectY(pos,vel);
        };

        Showcase.prototype.nextSlide = function() {
          let new_slide = this.active+1;
          //new_slide = new_slide>=this.slidesNum?0:new_slide;
          if(new_slide<this.slidesNum){
            this.active = new_slide;
            this.GL.changeTexture(this.active);
            this.options.onActiveIndexChange(this.active);
          }
        };

        Showcase.prototype.prevSlide = function() {
          let new_slide = this.active-1;
          if(new_slide>=0){
            this.active = new_slide;
            this.GL.changeTexture(this.active);
            this.options.onActiveIndexChange(this.active);
          }
        };

        Showcase.prototype.onResize = function () {
          this.GL.onResize();
        };


        class Slides {
          constructor(data) {
            this.data = data;
            this.container = document.getElementById('sections');
            this.active = 0;

            this.slides = [];
            this.slidesJquery = [];
            let that = this;
            $('.section').each(function(index){
                if(index==0){
                  $(this).addClass('active');
                }
                that.slides.push($(this).get(0));
                that.slidesJquery.push($(this));
            });
            this.slidesJquery[this.slidesJquery.length-1].addClass('prev');
            this.slidesJquery[1].addClass('next');
            this.size = this.slidesJquery.length;
          }
          activeChange(index){
            $('.section').removeClass('active').removeClass('prev');
            this.slidesJquery[index].addClass('active').removeClass('next').removeClass('prev');
            let next = index+1>this.size-1?0:index+1;
            let prev = index-1<0?this.size-1:index-1;
            this.slidesJquery[prev].addClass('prev');
            this.active = index;
          }
        }        


        const lerp = (a, b, n) => (1 - n) * a + n * b;
        const body = document.body;
        const getMousePos = (e) => {
            let posx = 0;
            let posy = 0;
            if (!e) e = window.event;
            if (e.pageX || e.pageY) {
                posx = e.pageX;
                posy = e.pageY;
            }
            else if (e.clientX || e.clientY)    {
                posx = e.clientX + body.scrollLeft + document.documentElement.scrollLeft;
                posy = e.clientY + body.scrollTop + document.documentElement.scrollTop;
            }
            return { x : posx, y : posy }
        }

        class Cursor {
            constructor(el) {
                this.DOM = {el: el};
                this.DOM.dot = this.DOM.el.querySelector('.cursor__inner--dot');
                this.DOM.circle = this.DOM.el.querySelector('.cursor__inner--circle');
                this.bounds = {dot: this.DOM.dot.getBoundingClientRect(), circle: this.DOM.circle.getBoundingClientRect()};
                this.scale = 1;
                this.opacity = 1;
                this.mousePos = {x:0, y:0};
                this.lastMousePos = {dot: {x:0, y:0}, circle: {x:0, y:0}};
                this.lastScale = 1;
                
                this.initEvents();
                requestAnimationFrame(() => this.render());
            }
            initEvents() {
                window.addEventListener('mousemove', ev => this.mousePos = getMousePos(ev));
            }
            render() {
                this.lastMousePos.dot.x = lerp(this.lastMousePos.dot.x, this.mousePos.x - this.bounds.dot.width/2, 1);
                this.lastMousePos.dot.y = lerp(this.lastMousePos.dot.y, this.mousePos.y - this.bounds.dot.height/2, 1);
                this.lastMousePos.circle.x = lerp(this.lastMousePos.circle.x, this.mousePos.x - this.bounds.circle.width/2, 0.15);
                this.lastMousePos.circle.y = lerp(this.lastMousePos.circle.y, this.mousePos.y - this.bounds.circle.height/2, 0.15);
                this.lastScale = lerp(this.lastScale, this.scale, 0.15);
                this.DOM.dot.style.transform = `translateX(${(this.lastMousePos.dot.x)}px) translateY(${this.lastMousePos.dot.y}px)`;
                this.DOM.circle.style.transform = `translateX(${(this.lastMousePos.circle.x)}px) translateY(${this.lastMousePos.circle.y}px) scale(${this.lastScale})`;
                requestAnimationFrame(() => this.render());
            }
            enter() {
                this.scale = 1.5;
                this.DOM.dot.style.display = 'none';
            }
            leave() {
                this.scale = 1;
                this.DOM.dot.style.display = '';
            }
        }


        const container = document.getElementById("app");
        const cursor = new Cursor(document.querySelector(".cursor"));
        const slidesData = [];
        $('.section').each(function(){
            let obj = {};
            obj.image = $(this).data('img');
            slidesData.push(obj);
        });

        const slides = new Slides(slidesData);
        const showcase = new Showcase(slidesData, {
          onActiveIndexChange: activeIndex => {
            slides.activeChange(activeIndex);
          },
          onIndexChange: index => {
            slides.onMove(index);
          },
          onZoomOutStart: ({ activeIndex }) => {
            cursor.enter();
          },
          onZoomOutFinish: ({ activeIndex }) => {},
          onFullscreenStart: ({ activeIndex }) => {
            cursor.leave();
          },
          onFullscreenFinish: ({ activeIndex }) => {}
        });

        showcase.mount(container);
        showcase.render();

        $(window).on("resize", function() {
          showcase.onResize();
        });

        let scrollDelay = false;
        $('#app').on('mousewheel', function(event) {
            event.preventDefault();
            if(!scrollDelay){
                scrollDelay = true;
                if (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0) {
                  showcase.prevSlide();
                  
                }
                else {
                  showcase.nextSlide();
                }
                setTimeout(function(){
                    scrollDelay = false;
                },2000);
            }
        });



        function MouseMove(el_id){
            var el = $(el_id);

            var pointer = {};
            pointer.x = 0;
            pointer.y = 0;
            pointer.vx = 0;
            pointer.vy = 0;

            var friction = 0.09;

            var pointer = { 
              x: 0, 
              y: 0 
            };

            window.addEventListener("mousemove", function(event) {
              pointer.x = event.clientX;
              pointer.y = event.clientY;
            });

            var tracker = pointer;
            tracker = createCircle(tracker);

            function createCircle(leader) {
              
              var vx = 0;
              var vy = 0;  
              
              var circle = {};
              
              TweenLite.set(circle, { 
                x: leader.x, 
                y: leader.y, 
              });
              
              var pos = circle;
              
              TweenMax.to(circle, 15, {
                x: "+=1",
                y: "+=1",
                repeat: -1,
                modifiers: {
                  x: modX,
                  y: modY
                }
              });
                
              function modX(x) {
                vx += (leader.x - pos.x);
                vx *= friction;

                x = pos.x + vx;

                showcase.onMouseMoveX(x,vx);
                return x;
              }
              
              function modY(y) {
                vy += (leader.y - pos.y) ;
                vy *= friction;

                y = pos.y + vy;
                showcase.onMouseMoveY(y,vy);
                return y;
              }
              
              return pos;
            }
        }

        MouseMove('#app');