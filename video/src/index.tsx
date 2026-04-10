import { loadFont as loadBebasNeue } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadDMMono } from "@remotion/google-fonts/DMMono";
import { registerRoot, Composition } from "remotion";
import React from "react";
import { Root } from './Root';
import { ApexDemo90 } from "./Demo90";

loadBebasNeue();
loadDMMono();

registerRoot(() => (
  <>
    <Composition
      id="ApexWalkthrough"
      component={Root}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="ApexDemo90"
      component={ApexDemo90}
      durationInFrames={2700}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
));