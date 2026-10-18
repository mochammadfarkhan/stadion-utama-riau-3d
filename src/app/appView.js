/**
 * Port `view` portal interior (spec §4.8). Memakai App.setView bila ada (M5). Bila belum (M4): menukar
 * scene/kamera pass adegan composer + kamera OutlinePass (+ GTAO bila aktif) langsung lewat `app.post`, dan
 * menyembunyikan label CSS2D eksterior. App.render tetap memperbarui matriks scene eksterior (murah) tetapi
 * scene eksterior tidak digambar. Kamera interior menyalin aspek kamera utama saat masuk.
 * @param {{scene:object, camera:object, post:{composer:{passes:object[]}, outlinePass:{camera:object}, gtaoPass?:object|null},
 *   labelRenderer?:{domElement:{style:object}}, setView?:Function}} app
 */
export function appViewPort(app) {
  const main = { scene: app.scene, camera: app.camera };
  return {
    setView(view = null) {
      if (typeof app.setView === 'function') {
        app.setView(view);
        return;
      }
      const scene = view?.scene ?? main.scene;
      const camera = view?.camera ?? main.camera;
      if (view && camera.isPerspectiveCamera && main.camera.isPerspectiveCamera) {
        camera.aspect = main.camera.aspect;
        camera.updateProjectionMatrix();
      }
      const [scenePass] = app.post.composer.passes;
      scenePass.scene = scene;
      scenePass.camera = camera;
      app.post.outlinePass.camera = camera;
      if (app.post.gtaoPass) {
        app.post.gtaoPass.scene = scene;
        app.post.gtaoPass.camera = camera;
      }
      if (app.labelRenderer?.domElement) app.labelRenderer.domElement.style.visibility = view ? 'hidden' : '';
    },
  };
}
