import moderngl_window as mglw


class MainWindow(mglw.WindowConfig):
    gl_version = (3, 3)
    title = "CPRenderer"
    window_size = (1280, 720)
    aspect_ratio = None
    resizable = False
    vsync = True

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def on_render(self, time: float, frame_time: float):
        self.ctx.clear(1.0, 0.0, 0.0, 0.0)


def main():
    # stage = Usd.Stage.Open("assets/scifi_room/scene.usdc")
    # meshes = []
    # for prim in stage.Traverse():
    #     if prim.IsA(UsdGeom.Mesh):
    #         meshes.append(prim)

    # print(meshes)

    MainWindow.run()


if __name__ == "__main__":
    main()
