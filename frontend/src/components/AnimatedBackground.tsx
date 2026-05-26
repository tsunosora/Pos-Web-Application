'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getPublicSettings } from '@/lib/api';

const CACHE_KEY = '__vl_login_cfg';

/* ---------- All keyframes prefixed vl- to avoid global conflicts ---------- */
const VL_STYLES = `
  @keyframes vl-ringOut {
    0%  { transform:scale(.95); opacity:.65; }
    100%{ transform:scale(1.8); opacity:0; }
  }
  @keyframes vl-iconPop {
    0%  { transform:scale(0) rotate(-18deg); opacity:0; }
    65% { transform:scale(1.1) rotate(3deg); opacity:1; }
    82% { transform:scale(.97) rotate(-1deg); }
    100%{ transform:scale(1) rotate(0); opacity:1; }
  }
  @keyframes vl-iconBob {
    0%,100%{ transform:translateY(0) rotate(0); }
    30%    { transform:translateY(-8px) rotate(1.5deg); }
    65%    { transform:translateY(-4px) rotate(-.8deg); }
  }
  @keyframes vl-arcPop {
    0%  { transform:scale(0); opacity:0; }
    70% { transform:scale(1.06); opacity:1; }
    100%{ transform:scale(1); opacity:1; }
  }
  @keyframes vl-ltPop {
    0%  { transform:scale(0) translateY(10px); opacity:0; }
    65% { transform:scale(1.15) translateY(-4px); opacity:1; }
    100%{ transform:scale(1) translateY(0); opacity:1; }
  }
  @keyframes vl-drawStroke {
    0%  { stroke-dashoffset:var(--len); opacity:1; }
    100%{ stroke-dashoffset:0; opacity:1; }
  }
  @keyframes vl-fillIn {
    0%  { opacity:0; }
    100%{ opacity:1; }
  }
  @keyframes vl-glowPulse {
    0%,100% { opacity:.5; transform:scale(1); }
    50%     { opacity:1;  transform:scale(1.15); }
  }
  @keyframes vl-spPop {
    0%,100%{ transform:scale(0) rotate(0);       opacity:0; }
    22%    { transform:scale(1.7) rotate(45deg);  opacity:1; }
    55%    { transform:scale(.9)  rotate(120deg); opacity:.6; }
    80%    { transform:scale(.3)  rotate(200deg); opacity:.1; }
  }
  @keyframes vl-kenBurns {
    0%   { transform: scale(1)    translate(0%,     0%);    }
    50%  { transform: scale(1.09) translate(-1.2%,  0.8%);  }
    100% { transform: scale(1.06) translate( 0.8%, -1.2%);  }
  }
  @keyframes vl-fadeIn {
    0%  { opacity:0; transform:scale(.97); }
    100%{ opacity:1; transform:scale(1); }
  }
  /* ── Responsive logo scaling for small/landscape viewports ── */
  .vl-scene { transform-origin: center top; }
  @media (max-height: 560px) { .vl-scene { transform: scale(0.72); } }
  @media (max-height: 440px) { .vl-scene { transform: scale(0.54); } }
  @media (max-width: 340px)  { .vl-scene { transform: scale(0.82); } }
`;

/* ---------- SVG path data — "Print" calligraphic stroke draw-in ---------- */
const PRINT_STROKES = [
  // Path 1 – i + dot
  "M1535.36,2903c6.57-10.06,13.81-17.47,21.72-22.19,7.91-4.72,15.85-7.41,23.82-8.04,13.16-1.06,24.21,2.24,33.15,9.87,8.93,7.64,12.93,17.97,12.01,30.99-.57,3.11-1.22,6.23-1.96,9.36-.74,3.13-2.08,6.3-4.03,9.52-5.49,9.31-10,17.16-13.56,23.58-3.56,6.42-6.82,12.39-9.79,17.91-2.98,5.53-5.86,10.95-8.64,16.28-2.79,5.34-6.18,11.74-10.15,19.22-4.76,8.9-10.1,18.62-16.02,29.14-5.91,10.53-11.58,21.3-17.01,32.29-5.43,11-10.16,21.77-14.18,32.32-4.02,10.55-6.33,20.11-6.94,28.67-.66,9.25,1.25,15.15,5.72,17.69,4.47,2.54,11.03,3.46,19.7,2.77,9.69-.78,19.97-3.65,30.84-8.61,10.85-4.96,21.89-11.12,33.09-18.5,11.19-7.37,22.29-15.67,33.28-24.91,10.99-9.23,21.37-18.49,31.16-27.8,9.78-9.3,18.86-18.21,27.21-26.72,8.35-8.5,15.35-16.06,20.98-22.64,7.39-7.06,14.54-10.88,21.48-11.43,6.23-.5,11.15,1.84,14.75,7,3.59,5.17,5.09,12.04,4.48,20.6-.56,7.89-3.15,16.44-7.76,25.67-4.62,9.24-11.71,18.15-21.27,26.75-18.93,19.24-38.16,37.74-57.67,55.49-19.52,17.76-39.33,33.66-59.44,47.71-20.11,14.06-40.14,25.63-60.07,34.72-19.94,9.09-39.77,14.43-59.52,16.02-28.06,2.25-49.64-3.1-64.74-16.02-15.1-12.93-21.58-34.48-19.44-64.64,1.12-15.76,4.46-31.36,10.04-46.81,5.57-15.44,11.98-30.52,19.23-45.25,7.24-14.72,14.79-28.96,22.66-42.71,7.86-13.74,14.64-26.81,20.35-39.2,2.05-4.59,5.56-11.69,10.55-21.29,4.98-9.6,10.24-19.39,15.77-29.38,6.34-11.76,13.08-24.22,20.22-37.4 M1600.72,2782.74c.56-7.88,2.61-16.13,6.15-24.77,3.53-8.63,8.49-16.61,14.87-23.94,6.37-7.32,14.14-13.57,23.29-18.74,9.15-5.16,19.78-8.23,31.91-9.2,20.09-1.61,33.84,1.12,41.27,8.19,7.42,7.07,10.72,16.44,9.89,28.09-.46,6.52-2.27,13.82-5.43,21.91-3.16,8.1-7.57,15.69-13.24,22.79-5.67,7.1-12.82,13.22-21.45,18.33-8.63,5.13-18.66,8.14-30.1,9.06-21.48,1.72-36.32-.41-44.5-6.4-8.19-5.99-12.41-14.42-12.67-25.31",
  // Path 2 – b
  "M748.51,3018.74c-7.61,14.92-16.11,32.82-25.51,53.67-9.41,20.87-19.56,42.64-30.47,65.32-10.91,22.69-22.41,45.25-34.51,67.69-12.1,22.44-24.55,42.61-37.36,60.5-12.81,17.9-25.74,32.66-38.79,44.26-13.05,11.6-25.99,17.93-38.8,18.96-10.74.86-19.46-.06-26.16-2.76-6.7-2.71-11.78-6.39-15.23-11.05-3.46-4.66-5.75-9.93-6.89-15.81-1.13-5.87-1.51-11.55-1.12-17.03.58-8.23,2.48-16.72,5.68-25.5,3.21-8.77,6.96-16.92,11.29-24.42l224.72-378.4c9.72-15.77,18.8-28.26,27.2-37.45,8.4-9.19,16.13-16.12,23.17-20.77,7.05-4.65,13.2-7.62,18.46-8.89,5.26-1.27,9.62-2.05,13.08-2.33,6.24-.5,11.8,1.18,16.69,5.05,4.89,3.87,6.94,11.46,6.14,22.77-.78,10.97-4.79,26.29-12.04,45.95-7.26,19.67-19.92,45.22-37.98,76.66,27.17-4.22,54.16-10.9,80.99-20.04,26.82-9.13,51.15-20.72,72.99-34.74,21.83-14.02,39.78-30.36,53.85-49.05,14.06-18.68,21.93-39.67,23.58-62.98,1.46-20.56-.53-39.91-5.96-58.05-5.43-18.14-14.14-33.8-26.12-46.98-11.98-13.18-27.21-23.2-45.66-30.08-18.46-6.87-40.16-9.3-65.1-7.3-33.95,2.72-63.36,8.24-88.23,16.53-24.87,8.31-46.43,18.29-64.64,29.98-18.23,11.68-33.7,24.68-46.42,38.99-12.73,14.31-23.82,28.67-33.28,43.05-9.46,14.39-17.96,28.53-25.48,42.43-7.53,13.89-15.22,26.27-23.04,37.12-7.83,10.85-16.48,19.81-25.93,26.87-9.46,7.07-20.77,11.12-33.93,12.18-16.98,1.36-29.24-1.91-36.76-9.83-7.54-7.91-10.74-19.76-9.62-35.52,1.12-15.76,6.67-33.33,16.65-52.71,9.98-19.37,23.61-39.12,40.89-59.25,17.27-20.12,37.86-39.75,61.79-58.88,23.91-19.12,50.55-36.51,79.91-52.16,29.35-15.64,61.03-28.83,95.04-39.57,34-10.73,69.53-17.59,106.6-20.56,34.64-2.78,67.64-.57,98.99,6.63,31.35,7.2,58.63,19.58,81.85,37.15,23.21,17.56,41.13,40.41,53.79,68.53,12.64,28.12,17.57,61.9,14.78,101.31-2.55,35.99-13.61,69.17-33.15,99.53-19.55,30.37-44.84,56.76-75.88,79.18-31.04,22.43-66.35,40.6-105.91,54.5-39.57,13.91-80.83,22.58-123.79,26.03-9.01.72-18.09,1.28-27.24,1.67-9.16.4-18.19.27-27.1-.38",
  // Path 3 – i n
  "M1208.51,2958.34c14.09-9.31,28.57-17.96,43.43-25.98,14.86-8.01,29.23-15.03,43.09-21.09,13.86-6.05,27.04-11.03,39.55-14.93,12.5-3.89,23.6-6.24,33.31-7.02,15.59-1.25,27.36,1.47,35.33,8.16,7.96,6.69,11.33,18.77,10.09,36.25-.27,3.78-.73,7.82-1.38,12.12-.65,4.32-1.66,8.91-3.05,13.79-2.37,9.06-8.31,19.92-17.81,32.61-9.51,12.7-20.53,26.02-33.06,39.97-12.53,13.96-25.94,28.07-40.2,42.33-14.28,14.27-27.44,27.43-39.48,39.46-12.05,12.04-22.09,22.47-30.12,31.3-8.04,8.83-12.16,14.78-12.37,17.86-.19,2.75-.16,4.61.12,5.61.27,1,1.79,1.39,4.57,1.17,19.27-9.38,40.81-20.56,64.64-33.55,23.82-12.98,47.59-26.22,71.28-39.71,23.69-13.48,46.14-26.62,67.38-39.4,21.23-12.77,39.23-23.85,54.02-33.21,3.24-1.96,6.54-3.67,9.92-5.14,3.37-1.46,6.44-2.31,9.22-2.53,6.24-.5,11.29,1.14,15.15,4.92,3.87,3.78,5.56,9.1,5.07,15.95-.56,7.89-4.58,17.15-12.05,27.8-7.47,10.65-19.57,22.1-36.28,34.35-12.67,8.52-26.86,18.09-42.6,28.72-15.74,10.64-32.2,21.67-49.37,33.1-17.18,11.43-34.5,22.62-51.98,33.56-17.49,10.95-34.29,20.82-50.41,29.6-16.12,8.79-31.19,16.05-45.2,21.77-14.02,5.72-26.04,8.99-36.09,9.79-23.9,1.92-41.43-2.3-52.58-12.65-11.15-10.35-16.09-24.44-14.83-42.26.19-2.74.51-4.81.96-6.21,3.49-15.27,9.03-30.2,16.61-44.78,7.57-14.58,15.97-28.54,25.19-41.89,9.21-13.34,18.73-26.12,28.55-38.33,9.82-12.2,18.81-23.66,26.98-34.37,8.16-10.7,14.97-20.54,20.43-29.5,5.45-8.95,8.44-17.03,8.95-24.23.12-1.71-.11-3.39-.67-5.06-.58-1.65-2.08-2.39-4.5-2.19-4.16.33-11.11,2.42-20.85,6.27-9.75,3.85-20.18,8.77-31.27,14.78-11.11,6-21.75,12.73-31.92,20.2-10.18,7.46-17.61,15.13-22.3,23-6.23,10.05-13.5,22.73-21.81,38.04-8.32,15.32-16.95,31.35-25.88,48.08-8.94,16.74-17.6,33.28-26,49.62-8.39,16.35-15.59,30.39-21.59,42.11-4.86,10.28-10.95,19.62-18.26,28.05-7.31,8.43-15.15,15.7-23.51,21.82-8.36,6.12-16.8,11.06-25.33,14.81-8.53,3.75-16.27,5.91-23.19,6.46-7.98.64-14.14-.91-18.53-4.65-4.38-3.74-6.25-10.23-5.59-19.49.27-3.77,1.2-8.53,2.82-14.28,1.61-5.75,4.56-12.2,8.86-19.37,7.06-12.15,14.28-25.34,21.66-39.57,7.38-14.22,15.85-30.49,25.42-48.81,9.57-18.32,20.61-39.31,33.14-62.98,12.53-23.66,27.29-51.01,44.31-82.02-4.56-3.72-8.27-8.45-11.14-14.19-2.87-5.73-3.98-13.05-3.35-21.97.58-8.23,2.82-15.47,6.71-21.75,3.88-6.27,8.91-11.53,15.07-15.78,6.15-4.24,13.2-7.62,21.13-10.13,7.93-2.5,16.22-4.11,24.88-4.81,9.01-.72,17.95-.67,26.86.15,8.89.82,16.79,2.49,23.67,5,6.88,2.52,12.42,5.83,16.61,9.92,4.18,4.1,6.08,9.06,5.66,14.88-.07,1.03-.52,2.43-1.33,4.2-.82,1.77-1.73,3.72-2.74,5.84-1.01,2.12-1.93,4.08-2.74,5.84-.82,1.78-1.26,3.17-1.33,4.2-.05.69.1,1.02.45.99l.52-.04,1.08-.6Z",
  // Path 4 – r
  "M1798.66,2898.75c7.97-15.29,17.41-26.96,28.31-34.99,10.9-8.03,21.37-12.45,31.42-13.25,8.32-.67,15.55,1.74,21.71,7.2,6.15,5.47,8.82,14.04,7.99,25.69-.32,4.46-1.18,9.3-2.58,14.52-1.4,5.22-3.7,10.86-6.88,16.91,8.3-10.2,19.91-20.93,34.83-32.19,14.92-11.25,31.24-21.59,48.96-31.02,17.72-9.42,35.85-17.44,54.41-24.04,18.55-6.6,35.96-10.55,52.25-11.86,18.36-1.47,33.38,1.67,45.06,9.42,11.67,7.75,16.78,22.09,15.29,42.99-.87,12.34-3.69,25.34-8.45,39.02-4.76,13.67-10.65,27.44-17.65,41.29-7.01,13.85-14.7,27.51-23.05,40.95-8.37,13.45-16.58,26.12-24.66,38.02-8.08,11.89-15.48,22.8-22.21,32.71-6.73,9.92-12.05,18.09-15.95,24.54-4.9,5.85-7.6,12.37-8.11,19.56-.19,2.75.5,5.07,2.09,6.99,1.58,1.92,4.28,2.73,8.1,2.42,2.42-.19,5.22-.67,8.37-1.44,3.15-.76,7.09-2.87,11.82-6.31,19.19-8.35,38.94-18.46,59.24-30.31,20.3-11.85,39.86-24.23,58.7-37.17,18.82-12.92,36.18-25.73,52.07-38.42,15.88-12.69,29.17-24.06,39.88-34.12,2.94-2.62,5.83-4.56,8.68-5.81,2.84-1.25,5.48-1.97,7.9-2.17,5.89-.47,10.32,1.39,13.3,5.58,2.97,4.19,4.22,9.72,3.73,16.57-.75,10.63-4.97,22.72-12.65,36.29-7.68,13.57-19.19,26.59-34.55,39.07-20.74,15.64-39.76,29.94-57.04,42.91-17.28,12.98-34.86,25.21-52.72,36.69-17.87,11.49-36.9,22.38-57.08,32.69-20.2,10.31-43.73,20.29-70.59,29.94-9.21,3.46-17.58,6.18-25.12,8.15-7.55,1.96-14.44,3.2-20.67,3.7-18.37,1.47-31.43-2.51-39.2-11.94-7.78-9.42-11.01-23.22-9.72-41.39.17-2.39.41-4.71.75-6.96.33-2.24.76-4.74,1.31-7.52,1.44-10.68,5.13-22.56,11.05-35.65,5.92-13.08,12.91-26.59,20.96-40.53,8.04-13.94,16.52-27.82,25.43-41.65,8.9-13.83,17.15-26.93,24.75-39.3,7.59-12.37,13.97-23.35,19.13-32.97,5.15-9.61,7.95-17.33,8.36-23.16.36-5.14-.8-9.39-3.49-12.76-2.69-3.36-6.98-4.81-12.87-4.33-22.17,1.78-43.68,9.98-64.52,24.6-20.85,14.63-40.6,32.14-59.27,52.55-18.68,20.41-36.03,41.83-52.09,64.24-16.06,22.42-30.23,42.47-42.5,60.15-7.74,11.87-14.91,24.45-21.54,37.76-6.63,13.31-13.46,25.79-20.48,37.43-7.03,11.64-14.7,21.46-23.01,29.45-8.32,7.99-18.37,12.46-30.14,13.41-12.13.97-21.39-2.04-27.78-9.02-6.4-6.98-9.2-15.96-8.42-26.93.41-5.82,3.5-15.44,9.28-28.86,5.77-13.41,13.08-28.99,21.92-46.74,8.83-17.74,18.71-36.85,29.64-57.33,10.92-20.47,21.83-40.77,32.74-60.9,10.9-20.12,21.28-39.1,31.16-56.94,9.87-17.83,18.01-32.96,24.41-45.41",
  // Path 5 – t
  "M2362.69,2879.59c-14.57,25.71-28.4,50.76-41.49,75.15-13.1,24.4-25.38,46.94-36.83,67.62-4.74,8.56-9.49,18.4-14.23,29.51-4.75,11.12-7.42,20.79-8,29.01-.34,4.81.51,8.48,2.58,11.04,2.05,2.57,5.69,3.63,10.88,3.22,7.27-.58,16.6-3.46,28-8.64,11.39-5.17,23.74-11.78,37.06-19.84,13.31-8.05,27.39-17.19,42.24-27.41,14.85-10.22,29.45-20.76,43.84-31.63,14.37-10.86,28.15-21.68,41.31-32.45,13.16-10.77,24.89-20.65,35.17-29.66,5.81-4.21,11.14-6.52,15.99-6.91,5.89-.47,10.55,1.71,14,6.54,3.44,4.84,4.89,11.2,4.33,19.08-.56,7.89-3.04,16.09-7.43,24.62-4.4,8.53-11.9,17.15-22.5,25.83-23.96,22.03-48.09,43.05-72.42,63.06-24.33,20.02-48.33,37.87-72,53.57-23.68,15.7-46.9,28.55-69.65,38.56-22.76,10-44.53,15.84-65.31,17.5-13.86,1.11-25.34.24-34.43-2.61-9.1-2.85-16.28-7.21-21.55-13.1-5.27-5.88-8.82-12.92-10.64-21.13-1.83-8.2-2.4-17.1-1.72-26.7,1.21-17.14,5.42-35.2,12.62-54.18,7.2-18.98,14.96-36.13,23.28-51.45,11.9-22.08,23.7-43.99,35.4-65.72,11.7-21.72,23.08-42.57,34.14-62.55l-22.35,1.79c-19.41,1.56-32.52-.46-39.36-6.04-6.84-5.59-9.98-12.32-9.42-20.2.24-3.42,1.66-7.71,4.27-12.87,2.6-5.14,6.22-10.04,10.86-14.67,4.63-4.63,10.18-8.74,16.63-12.32,6.45-3.59,13.66-5.7,21.63-6.34l56.12-4.5,124.92-224.2c7.85-13.58,17.08-23.6,27.71-30.08,10.62-6.47,21.47-10.15,32.56-11.04,10.39-.83,19.72,1.15,28,5.93,8.27,4.79,11.96,13.53,11.06,26.21-.46,6.51-2.41,13.23-5.82,20.15-3.42,6.92-7.87,15.03-13.35,24.33-3.53,6.08-7.84,13.33-12.91,21.74-5.08,8.42-10.45,17.37-16.11,26.85-5.67,9.49-11.54,19.42-17.61,29.78-6.08,10.38-12.04,20.39-17.89,30.06-13.34,22.88-27.45,47.02-42.34,72.41l169.4-13.58c8.31-.67,15.9-.84,22.77-.55,6.87.3,12.72,1.54,17.56,3.7,4.84,2.17,8.48,5.37,10.95,9.6,2.45,4.24,3.41,10.12,2.88,17.66-.27,3.77-1.14,7.59-2.62,11.46-1.49,3.87-3.98,7.47-7.48,10.82-3.52,3.35-8.2,6.28-14.06,8.8-5.86,2.51-13.32,4.48-22.38,5.88l-216.28,18.88Z",
];

const STROKE_ANIMS = [
    { stroke: 'vl-drawStroke .65s ease-out 1.55s forwards', fill: 'vl-fillIn .25s ease-out 2.18s forwards' },
    { stroke: 'vl-drawStroke .75s ease-out 1.72s forwards', fill: 'vl-fillIn .25s ease-out 2.45s forwards' },
    { stroke: 'vl-drawStroke .80s ease-out 1.89s forwards', fill: 'vl-fillIn .25s ease-out 2.67s forwards' },
    { stroke: 'vl-drawStroke .85s ease-out 2.06s forwards', fill: 'vl-fillIn .25s ease-out 2.89s forwards' },
    { stroke: 'vl-drawStroke .80s ease-out 2.23s forwards', fill: 'vl-fillIn .25s ease-out 3.01s forwards' },
];

const SPARKLES = [
    { w: 9, h: 9, bg: '#e61b4d', pos: { top: '8%',    right: '4%'    }, anim: 'vl-spPop 2.5s ease-in-out 2.0s infinite' },
    { w: 6, h: 6, bg: '#30a0da', pos: { top: '20%',   left:  '0%'    }, anim: 'vl-spPop 2.1s ease-in-out 2.5s infinite' },
    { w: 8, h: 8, bg: '#e6b022', pos: { bottom:'20%', right: '2%'    }, anim: 'vl-spPop 2.8s ease-in-out 1.9s infinite' },
    { w: 5, h: 5, bg: '#fff',    pos: { top: '50%',   left:  '-2%'   }, anim: 'vl-spPop 3.0s ease-in-out 2.7s infinite' },
    { w: 7, h: 7, bg: '#e61b4d', pos: { bottom:'30%', left:  '3%'    }, anim: 'vl-spPop 2.3s ease-in-out 3.1s infinite' },
    { w: 5, h: 5, bg: '#30a0da', pos: { top: '3%',    left:  '14%'   }, anim: 'vl-spPop 2.0s ease-in-out 2.2s infinite' },
];

const LT_LETTERS = [
    { delay: '.88s',  children: () => <polygon fill="#fff" points="613.8,2158.93 381.89,2700.06 231.14,2700.06 0,2158.93 165.43,2158.93 312.31,2511.44 462.28,2158.93" /> },
    { delay: '.97s',  children: () => <><path fill="#fff" d="M610.72,2429.5c0-162.34,127.55-281.39,300.72-281.39s300.72,119.05,300.72,281.39-127.55,281.39-300.72,281.39S610.72,2591.84,610.72,2429.5z"/><path fill="#696969" d="M1057.54,2429.5c0-93.54-64.16-154.61-146.11-154.61s-146.11,61.07-146.11,154.61s64.16,154.61,146.11,154.61S1057.54,2523.04,1057.54,2429.5z"/></> },
    { delay: '1.06s', children: () => <polygon fill="#fff" points="1292.54,2158.93 1445.61,2158.93 1445.61,2578.69 1703.81,2578.69 1703.81,2700.06 1292.54,2700.06" /> },
    { delay: '1.15s', children: () => <rect fill="#fff" x="1764.1" y="2158.93" width="153.07" height="541.14" /> },
    { delay: '1.24s', children: () => <polygon fill="#fff" points="2234.88,2503.71 2177.67,2564.78 2177.67,2700.06 2026.15,2700.06 2026.15,2158.93 2177.67,2158.93 2177.67,2383.88 2387.17,2158.93 2555.7,2158.93 2334.6,2398.57 2567.29,2700.06 2389.49,2700.06" /> },
    { delay: '1.33s', children: () => <><path fill="#fff" d="M2560.34,2429.5c0-162.34,127.55-281.39,300.72-281.39s300.72,119.05,300.72,281.39-127.55,281.39-300.72,281.39S2560.34,2591.84,2560.34,2429.5z"/><path fill="#696969" d="M3007.16,2429.5c0-93.54-64.16-154.61-146.11-154.61s-146.11,61.07-146.11,154.61s64.16,154.61,146.11,154.61S3007.16,2523.04,3007.16,2429.5z"/></> },
];

type PublicSettings = {
    storeName: string;
    logoImageUrl: string | null;
    loginLogoUrl: string | null;
    loginBgImages: string[];
    loginTaglines: string[];
    theme?: {
        mode: 'SOLID' | 'GRADIENT';
        primaryColor: string;
        secondaryColor: string;
        gradientDirection: string;
    };
};

export function AnimatedBackground() {
    const [settings, setSettings] = useState<PublicSettings>({
        storeName: 'PosPro',
        logoImageUrl: null,
        loginLogoUrl: null,
        loginBgImages: [],
        loginTaglines: [],
    });
    const [activeSlide, setActiveSlide] = useState(0);
    const [taglineIdx, setTaglineIdx] = useState(0);
    // logoKey: berubah setiap kali loginLogoUrl berganti → trigger fade-in ulang
    const [logoKey, setLogoKey] = useState(0);
    const prevLoginLogoRef = useRef<string | null>(undefined as unknown as null);
    const strokeRefs = useRef<(SVGPathElement | null)[]>([null, null, null, null, null]);
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // ① Baca cache SEBELUM browser paint — eliminasi flash logo pada kunjungan ulang
    useLayoutEffect(() => {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (raw) setSettings(JSON.parse(raw));
        } catch {}
    }, []);

    // ② Fetch fresh dari API, lalu perbarui cache
    useEffect(() => {
        getPublicSettings().then(fresh => {
            setSettings(fresh);
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(fresh)); } catch {}
        }).catch(() => {});
    }, []);

    /* Deteksi perubahan loginLogoUrl → increment logoKey untuk re-trigger fade-in */
    useEffect(() => {
        if (prevLoginLogoRef.current !== settings.loginLogoUrl) {
            prevLoginLogoRef.current = settings.loginLogoUrl;
            setLogoKey(k => k + 1);
        }
    }, [settings.loginLogoUrl]);

    /* Init stroke-dashoffset — must run after mount so paths are in the DOM */
    useEffect(() => {
        strokeRefs.current.forEach(p => {
            if (!p) return;
            const len = Math.ceil(p.getTotalLength());
            p.style.strokeDasharray = String(len);
            p.style.strokeDashoffset = String(len);
            p.style.setProperty('--len', String(len));
        });
    }, []);

    /* Background slideshow */
    useEffect(() => {
        if (settings.loginBgImages.length < 2) return;
        const id = setInterval(
            () => setActiveSlide(i => (i + 1) % settings.loginBgImages.length),
            6000,
        );
        return () => clearInterval(id);
    }, [settings.loginBgImages.length]);

    /* Tagline cycling */
    useEffect(() => {
        if (settings.loginTaglines.length < 2) return;
        const id = setInterval(
            () => setTaglineIdx(i => (i + 1) % settings.loginTaglines.length),
            5000,
        );
        return () => clearInterval(id);
    }, [settings.loginTaglines.length]);

    const taglines = settings.loginTaglines.length > 0
        ? settings.loginTaglines
        : ['Solusi POS Terpadu untuk Bisnis Anda'];

    return (
        <>
            <style>{VL_STYLES}</style>

            {/* ── Background images with Ken Burns zoom ── */}
            <div className="absolute inset-0 overflow-hidden">
                {settings.loginBgImages.length > 0 ? (
                    settings.loginBgImages.map((img, i) => (
                        <div
                            key={i}
                            className="absolute inset-0 transition-opacity duration-1000"
                            style={{ opacity: i === activeSlide ? 1 : 0 }}
                        >
                            <div
                                className="absolute inset-0 bg-cover bg-center"
                                style={{
                                    backgroundImage: `url(${base}${img})`,
                                    animation: i === activeSlide ? 'vl-kenBurns 6s ease-in-out forwards' : 'none',
                                    willChange: i === activeSlide ? 'transform' : 'auto',
                                }}
                            />
                        </div>
                    ))
                ) : (
                    // Theme-aware background — pakai gradient/solid dari StoreSettings.theme,
                    // fallback ke default dark gradient kalau belum di-load.
                    <div
                        className="absolute inset-0"
                        style={{
                            background: settings.theme
                                ? (settings.theme.mode === 'GRADIENT'
                                    ? `linear-gradient(${settings.theme.gradientDirection}, ${settings.theme.primaryColor}, ${settings.theme.secondaryColor})`
                                    : settings.theme.primaryColor)
                                : 'linear-gradient(to bottom right, #1a0510, #2d0818, #08152a)',
                        }}
                    />
                )}
                {/* Dim overlay: hanya untuk bg images supaya teks/logo putih kebaca.
                    Kalau pakai theme color saja, overlay di-skip — warna tampil murni. */}
                {settings.loginBgImages.length > 0 && (
                    <div className="absolute inset-0 bg-black/55" />
                )}
            </div>

            {/* ── Ambient glow ── */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: 'radial-gradient(ellipse 55% 45% at 50% 46%, rgba(230,27,77,0.10) 0%, transparent 68%)',
                    animation: 'vl-glowPulse 4s ease-in-out infinite',
                }}
            />

            {/* ── Store logo / name ── */}
            <div className="relative z-20 flex items-center gap-2.5">
                {settings.logoImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={`${base}${settings.logoImageUrl}`}
                        alt="logo"
                        className="h-8 w-8 object-contain rounded"
                    />
                )}
                <span className="text-lg font-semibold text-white/90 tracking-wide">
                    {settings.storeName}
                </span>
            </div>

            {/* ── Centerpiece: custom logo (kalau di-set) ATAU animasi Voliko default ── */}
            <div className="relative z-20 flex flex-1 items-center justify-center">
                {settings.loginLogoUrl ? (
                    // Custom logo — replace animasi Voliko. Sparkles & ring tetap di sekeliling.
                    <div
                        key={logoKey}
                        className="vl-scene relative flex flex-col items-center"
                        style={{ animation: 'vl-fadeIn .4s ease-out both' }}
                    >
                        <div className="absolute pointer-events-none" style={{ inset: '-60px', zIndex: 0 }}>
                            {SPARKLES.map((sp, i) => (
                                <div
                                    key={i}
                                    className="absolute rounded-full opacity-0"
                                    style={{ width: sp.w, height: sp.h, background: sp.bg, ...sp.pos, animation: sp.anim }}
                                />
                            ))}
                        </div>
                        <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
                            <div className="absolute inset-0 rounded-full border-2 opacity-0"
                                style={{ borderColor: 'rgba(230,27,77,.45)', animation: 'vl-ringOut 2.6s ease-out 1.3s infinite' }} />
                            <div className="absolute inset-0 rounded-full border-2 opacity-0"
                                style={{ borderColor: 'rgba(48,160,218,.35)', animation: 'vl-ringOut 2.6s ease-out 1.9s infinite' }} />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={`${base}${settings.loginLogoUrl}`}
                                alt="Login Logo"
                                className="relative z-10 max-w-full max-h-full object-contain"
                                style={{
                                    animation: 'vl-iconPop .85s cubic-bezier(.34,1.56,.64,1) .1s both, vl-iconBob 4s ease-in-out 1.8s infinite',
                                    filter: 'drop-shadow(0 10px 32px rgba(0,0,0,.4)) drop-shadow(0 2px 10px rgba(0,0,0,.5))',
                                }}
                            />
                        </div>
                    </div>
                ) : (
                <div
                    key={logoKey}
                    className="vl-scene relative flex flex-col items-center"
                    style={{ animation: 'vl-fadeIn .35s ease-out both' }}
                >

                    {/* Sparkles */}
                    <div className="absolute pointer-events-none" style={{ inset: '-60px', zIndex: 0 }}>
                        {SPARKLES.map((sp, i) => (
                            <div
                                key={i}
                                className="absolute rounded-full opacity-0"
                                style={{ width: sp.w, height: sp.h, background: sp.bg, ...sp.pos, animation: sp.anim }}
                            />
                        ))}
                    </div>

                    {/* Icon with pulsing rings */}
                    <div className="relative flex items-center justify-center" style={{ width: 180, height: 180, marginBottom: 10 }}>
                        <div className="absolute inset-0 rounded-full border-2 opacity-0"
                            style={{ borderColor: 'rgba(230,27,77,.55)', animation: 'vl-ringOut 2.6s ease-out 1.3s infinite' }} />
                        <div className="absolute inset-0 rounded-full border-2 opacity-0"
                            style={{ borderColor: 'rgba(48,160,218,.4)', animation: 'vl-ringOut 2.6s ease-out 1.9s infinite' }} />
                        <div className="absolute inset-0 rounded-full border-2 opacity-0"
                            style={{ borderColor: 'rgba(230,176,34,.3)', animation: 'vl-ringOut 2.6s ease-out 2.5s infinite' }} />
                        <svg viewBox="669 0 1823 1824" xmlns="http://www.w3.org/2000/svg" className="relative z-10"
                            style={{
                                width: 180, height: 180, transformOrigin: 'center', overflow: 'visible',
                                animation: 'vl-iconPop .85s cubic-bezier(.34,1.56,.64,1) .1s both, vl-iconBob 4s ease-in-out 1.8s infinite',
                                filter: 'drop-shadow(0 10px 32px rgba(230,27,77,.35)) drop-shadow(0 2px 10px rgba(0,0,0,.5))',
                            }}>
                            <path fill="#fff"    style={{ animation: 'vl-arcPop .4s ease-out .25s both', transformOrigin: '50% 50%' }} d="M2492.46,911.57c0,503.45-408.12,911.57-911.57,911.57s-911.57-408.12-911.57-911.57S1077.44,0,1580.89,0s911.57,408.12,911.57,911.57" />
                            <path fill="#e6b022" style={{ animation: 'vl-arcPop .5s cubic-bezier(.34,1.56,.64,1) .44s both', transformOrigin: '50% 50%' }} d="M2416.67,911.57c0,202.03-72.06,387.57-191.84,532.22c-98.4-173.76-196.58-347.65-294.81-521.53c100.63-178.07,201.19-356.2,301.92-534.2c115.52,143.36,184.73,325.5,184.73,523.51" />
                            <path fill="#e61b4d" style={{ animation: 'vl-arcPop .5s cubic-bezier(.34,1.56,.64,1) .60s both', transformOrigin: '50% 50%' }} d="M1986.44,1642.18c-120.17,66.99-258.5,105.17-405.56,105.17c-460.85,0-835.78-374.94-835.78-835.78c0-18.19.58-36.24,1.73-54.13c38.18-25.15,82.18-40.73,128.81-40.53c97.4-7.97,194.59,49.06,239.71,134.93c24.59,43.96,50.57,87.25,74.1,131.93c3.94,7.73,11.91,23.31,15.82,31.03l3.34-.91c100.19,182.01,201.86,363.33,306.9,542.46c61.97-111.27,125.69-221.61,187.55-332.99c17.09-30.15,34.19-60.31,51.24-90.46c77.16,136.55,154.56,272.98,232.13,409.29" />
                            <path fill="#30a0da" style={{ animation: 'vl-arcPop .5s cubic-bezier(.34,1.56,.64,1) .76s both', transformOrigin: '50% 50%' }} d="M1995.51,186.09c-160.74,282.61-320.8,565.66-479.41,849.42c-63.37-95.22-107.69-201.62-171.52-296.51l-19.89-20.25-.02.28c-26.12-27.02-56.28-49.39-88.11-69.25c-139.32-73.17-318.68-43.4-435.93,58.4c-2.76,2.76-8.3,8.42-11.09,11.2c-10.06,9.8-19.69,20.14-28.81,30.94c75.35-383.97,414.46-674.54,820.16-674.54c150.77,0,292.37,40.14,414.62,110.3" />
                        </svg>
                    </div>

                    {/* VOLIKO wordmark + Print */}
                    <div className="relative flex flex-col items-center">
                        <svg viewBox="-20 2103 3202 651" xmlns="http://www.w3.org/2000/svg" overflow="visible"
                            style={{ display: 'block', width: 240, filter: 'drop-shadow(0 2px 12px rgba(255,255,255,.07))', position: 'relative', zIndex: 1 }}>
                            {LT_LETTERS.map((lt, i) => (
                                <g key={i} style={{ transformOrigin: 'center', animation: `vl-ltPop .42s cubic-bezier(.34,1.56,.64,1) ${lt.delay} both` }}>
                                    {lt.children()}
                                </g>
                            ))}
                        </svg>

                        {/* Print calligraphic stroke-draw */}
                        <div style={{ position: 'relative', marginTop: '-18px', zIndex: 2 }}>
                            <svg viewBox="440 2680 2350 690" xmlns="http://www.w3.org/2000/svg" overflow="visible"
                                style={{ display: 'block', width: 185, filter: 'drop-shadow(0 2px 8px rgba(229,30,78,.3))' }}>
                                {PRINT_STROKES.map((d, i) => (
                                    <g key={i}>
                                        <path
                                            ref={el => { strokeRefs.current[i] = el; }}
                                            fill="none" stroke="#e51e4e" strokeWidth="14"
                                            strokeLinecap="round" strokeLinejoin="round"
                                            opacity="0"
                                            style={{ animation: STROKE_ANIMS[i].stroke }}
                                            d={d}
                                        />
                                        <path
                                            fill="#e51e4e" opacity="0"
                                            style={{ animation: STROKE_ANIMS[i].fill }}
                                            d={d}
                                        />
                                    </g>
                                ))}
                            </svg>
                        </div>
                    </div>
                </div>
                )}
            </div>

            {/* ── Taglines ── */}
            <div className="relative z-20 h-8 mt-auto">
                {taglines.map((t, i) => (
                    <p
                        key={i}
                        className="absolute inset-x-0 text-center text-sm text-white/75 transition-all duration-500"
                        style={{
                            opacity: i === taglineIdx ? 1 : 0,
                            transform: i === taglineIdx ? 'translateY(0)' : 'translateY(8px)',
                        }}
                    >
                        {t}
                    </p>
                ))}
            </div>
        </>
    );
}
