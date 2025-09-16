from pathlib import Path

from moderngl import VertexArray
from pxr import Usd, UsdGeom, UsdShade
from pyglm import glm

from .models import Scene


def load_mesh_from_usd(
    mesh_data: UsdGeom.Mesh, transform: glm.mat4, deep: int
) -> VertexArray:
    indent = "  " * deep
    print(indent + " points:", mesh_data.GetPointsAttr().Get()[:4], "...")
    print(
        indent + " face vertex indices:",
        mesh_data.GetFaceVertexIndicesAttr().Get()[:4],
        "...",
    )
    print(
        indent + " face vertex counts:",
        mesh_data.GetFaceVertexCountsAttr().Get()[:4],
        "...",
    )
    print(indent + " normals:", mesh_data.GetNormalsAttr().Get()[:4], "...")


def load_meshes_from_usd(
    prim: Usd.Prim, deep: int, transform: glm.mat4
) -> list[VertexArray]:
    if prim.IsA(UsdShade.Material) or prim.IsA(UsdGeom.Scope):
        return []

    indent = "  " * deep
    name = prim.GetName()
    if name == "/":
        type_name = "ROOT"
    else:
        type_name = prim.GetTypeName()
    print(indent + type_name, name)
    meshes = []
    if prim.IsA(UsdGeom.Mesh):
        mesh_data = UsdGeom.Mesh(prim)
        mesh = load_mesh_from_usd(mesh_data, transform, deep + 1)
        meshes.append(mesh)
    elif prim.IsA(UsdGeom.Xform):
        translate = prim.GetAttribute("xformOp:translate").Get()
        rotate = prim.GetAttribute("xformOp:rotateXYZ").Get()
        scale = prim.GetAttribute("xformOp:scale").Get()
        if translate is None:
            translate = (0, 0, 0)
        if rotate is None:
            rotate = (0, 0, 0)
        if scale is None:
            scale = (1, 1, 1)
        transform = glm.translate(glm.mat4(1), glm.vec3(*translate))
        transform = glm.rotate(transform, glm.radians(rotate[0]), glm.vec3(1, 0, 0))
        transform = glm.rotate(transform, glm.radians(rotate[1]), glm.vec3(0, 1, 0))
        transform = glm.rotate(transform, glm.radians(rotate[2]), glm.vec3(0, 0, 1))
        transform = glm.scale(transform, glm.vec3(*scale))
        print(indent + "  translate:", translate)
        print(indent + "  rotate:", rotate)
        print(indent + "  scale:", scale)
    # print(indent + "  transform:", transform)

    for child in prim.GetChildren():
        meshes += load_meshes_from_usd(child, deep + 1, transform)

    return meshes


def load_scene_from_usd(stage: Usd.Stage) -> Scene:
    root = stage.GetPseudoRoot()
    meshes = load_meshes_from_usd(root, 0, glm.mat4(1))
    print("meshes:", meshes)

    return
    for prim in stage.Traverse():
        path = prim.GetPath()
        deep = len(str(path).split("/")) - 1
        indent = "  " * deep
        print(indent + prim.GetTypeName(), prim.GetName())
        if prim.IsA(UsdGeom.Mesh):
            mesh_data = UsdGeom.Mesh(prim)
            mesh = load_mesh_from_usd(mesh_data, deep + 1)
        elif prim.IsA(UsdGeom.Xform):
            print(indent + "  translate:", prim.GetAttribute("xformOp:translate").Get())
            print(indent + "  rotate:", prim.GetAttribute("xformOp:rotateXYZ").Get())
            print(indent + "  scale:", prim.GetAttribute("xformOp:scale").Get())

    scene = Scene()
    return scene


def load_scene_from_file(path: Path) -> Scene:
    if path.is_dir():
        path = path / "scene.usda"

    stage = Usd.Stage.Open(str(path))
    scene = load_scene_from_usd(stage)

    return scene
