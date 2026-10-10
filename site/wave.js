// Decorative animated dot-wave behind the account pages. Pauses when hidden; drawn once for reduced motion.
(function () {
  var c = document.getElementById("wave"); if (!c || !c.getContext) return;
  var x = c.getContext("2d"); if (!x) return;
  var rm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches, W, H, t = 0, raf;
  function size() { var d = Math.min(window.devicePixelRatio || 1, 2); W = c.clientWidth; H = c.clientHeight; c.width = W * d; c.height = H * d; x.setTransform(d, 0, 0, d, 0, 0); }
  function draw() {
    var light = document.documentElement.dataset.theme === "light", cols = Math.ceil(W / 16), rows = 22;
    x.clearRect(0, 0, W, H);
    for (var r = 0; r < rows; r++) {
      var d = r / rows;
      for (var i = 0; i <= cols; i++) {
        var y = H * 0.3 + d * H * 0.68 + Math.sin(i * 0.35 + t + r * 0.5) * 14 * (1 - d * 0.4) + Math.cos(i * 0.12 - t * 0.7) * 10;
        x.fillStyle = "hsla(" + (215 + (i / cols) * 100) + ",90%," + (light ? 42 : 68) + "%," + (0.12 + d * 0.7) + ")";
        x.beginPath(); x.arc(i * 16, y, 0.8 + d * 1.6, 0, 6.283); x.fill();
      }
    }
  }
  function loop() { t += 0.02; draw(); raf = requestAnimationFrame(loop); }
  size(); window.addEventListener("resize", function () { size(); if (rm) draw(); });
  if (rm) { draw(); return; }
  loop();
  document.addEventListener("visibilitychange", function () { if (document.hidden) cancelAnimationFrame(raf); else loop(); });
})();
