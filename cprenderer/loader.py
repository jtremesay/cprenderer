from pathlib import Path

from pxr import Usd

from .models import Scene


def load_scene_from_file(path: Path) -> Scene:
    if path.is_dir():
        path = path / "scene.usdc"

    stage = Usd.Stage.Open(str(path))
    for prim in stage.Traverse():
        path = prim.GetPath()
        deep = len(str(path).split("/")) - 1
        indent = "  " * deep
        print(indent + prim.GetTypeName(), prim.GetName())

    scene = Scene()
    return scene
