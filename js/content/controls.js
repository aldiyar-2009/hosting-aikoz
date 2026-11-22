import { ru } from './ru.js';
const c = ru.controls;
export const CONTROLS = [
    { id: 'button', poi: 'POI_button', ...c.button, view: [-0.07, 0.10, 0.10] },
    { id: 'touchpad', poi: 'POI_touchpad', ...c.touchpad, view: [-0.17, 0.03, 0.05] },
    { id: 'slider', poi: 'POI_slider', ...c.slider, view: [-0.09, 0.03, -0.05] },
    { id: 'camera', poi: 'POI_camera', ...c.camera, view: [-0.03, 0.02, 0.16] },
    { id: 'led', poi: 'POI_led', ...c.led, view: [0.03, 0.02, 0.16] },
    { id: 'charge', poi: 'POI_charge', ...c.charge, view: [0.02, -0.07, -0.15] },
    { id: 'speaker', poi: 'POI_speaker', ...c.speaker, view: [-0.10, -0.10, -0.05] },
];
