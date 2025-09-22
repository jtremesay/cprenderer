import './scss/main.scss';
import * as bootstrap from 'bootstrap'


import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
const gltf = await load("scifi_room/scene.gltf", GLTFLoader);
console.log(gltf);