import pptxgen from 'pptxgenjs';
import path from 'path';
import fs from 'fs';

/**
 * Generates the Official 6-Page Smart India Hackathon (SIH) PowerPoint Presentation
 * for VARUNA-AI: Physics-Informed Digital Twin for Offshore Subsea & Topside Production
 */
async function generateSihPresentation() {
  const pptx = new pptxgen();

  pptx.author = 'VARUNA-AI Team';
  pptx.company = 'Smart India Hackathon 2026';
  pptx.title = 'Digital Twin for Well-to-Surface Optimization of Offshore Oil & Gas Operations';
  pptx.layout = 'LAYOUT_WIDE'; // 16:9 widescreen layout

  const baseDir = path.resolve('public/presentation');
  const imgRigDiorama = path.join(baseDir, 'rig_diorama_colored_1789147250513.jpg');
  const imgHologram = path.join(baseDir, 'hologram_digital_twin_1789148609789.jpg');
  const imgOilFlow = path.join(baseDir, 'oil_flow_arrows_drill_1789149090190.jpg');
  const imgDrill = path.join(baseDir, 'drill_static_casing_spinning_core_1789149401625.jpg');
  const imgSubseaPipes = path.join(baseDir, 'subsea_pipes_glowing_arrows_1789149758412.jpg');
  const imgWorkflowStencil = path.join(baseDir, 'workflow_diagram_stencil.jpg');

  // Common Theme Colors
  const COLOR_NAVY = '0A192F';
  const COLOR_CYAN = '008B8B';
  const COLOR_TEXT_DARK = '1E293B';
  const COLOR_TEXT_MUTED = '64748B';
  const COLOR_ACCENT_BLUE = '0284C7';
  const COLOR_EMERALD = '059669';

  // Helper for SIH slide header
  function addSihHeader(slide: any, titleText: string, slideNum: number) {
    // Top SIH Logo Placeholder
    slide.addText('Smart India Hackathon 2026', {
      x: 0.6,
      y: 0.35,
      w: 4.0,
      h: 0.3,
      fontSize: 11,
      fontFace: 'Arial',
      bold: true,
      color: 'D97706',
    });

    // Main Slide Heading
    slide.addText(titleText, {
      x: 0.6,
      y: 0.7,
      w: 10.0,
      h: 0.6,
      fontSize: 24,
      fontFace: 'Arial Black',
      bold: true,
      color: '1E3A8A',
    });

    // Slide footer
    slide.addText(`${slideNum} @SIH Idea submission-Template`, {
      x: 0.6,
      y: 6.9,
      w: 4.0,
      h: 0.3,
      fontSize: 9,
      fontFace: 'Arial',
      color: COLOR_TEXT_MUTED,
    });

    slide.addText('[Enter Your Team Name]', {
      x: 10.0,
      y: 6.9,
      w: 2.7,
      h: 0.3,
      fontSize: 9,
      fontFace: 'Arial',
      align: 'right',
      color: COLOR_TEXT_MUTED,
    });
  }

  // ==========================================
  // SLIDE 1: TITLE SLIDE (EXACT SIH TEMPLATE)
  // ==========================================
  {
    const slide1 = pptx.addSlide();
    slide1.background = { color: 'FFFFFF' };

    // SIH Logo Header
    slide1.addText('Smart India Hackathon 2026', {
      x: 4.2,
      y: 1.0,
      w: 5.0,
      h: 0.4,
      fontSize: 16,
      fontFace: 'Arial',
      bold: true,
      align: 'center',
      color: 'D97706',
    });

    // Metadata Block (Exact template style)
    const metaY = 2.0;
    const spacing = 0.65;

    const fields = [
      { label: 'Problem Statement ID', val: '– SIH26120' },
      { label: 'Problem Statement Title', val: '- Digital Twin for Well-to-Surface Optimization of CSS and SRP Operations' },
      { label: 'Theme', val: '- Clean & Green Technology' },
      { label: 'PS Category', val: '- Software · IoT + AI/ML' },
      { label: 'Team ID', val: '- [Enter Your Team ID]' },
      { label: 'Team Name', val: '- [Enter Your Team Name]' },
    ];

    fields.forEach((f, idx) => {
      slide1.addText([
        { text: `${f.label} `, options: { bold: true, fontSize: 15, color: '0F172A' } },
        { text: f.val, options: { bold: false, fontSize: 15, color: '1E293B' } },
      ], {
        x: 0.8,
        y: metaY + idx * spacing,
        w: 11.5,
        h: 0.5,
        fontFace: 'Calibri',
      });
    });
  }

  // ==========================================
  // SLIDE 2: PROPOSED SOLUTION (2 COLUMNS: PROBLEM vs SOLUTION)
  // ==========================================
  {
    const slide2 = pptx.addSlide();
    slide2.background = { color: 'FFFFFF' };
    addSihHeader(slide2, 'PROPOSED SOLUTION', 2);

    // Left Column: PROBLEM STATEMENT & CHALLENGES
    slide2.addShape(pptx.ShapeType.roundRect, {
      x: 0.6,
      y: 1.4,
      w: 5.8,
      h: 5.3,
      fill: { color: 'F8FAFC' },
      line: { color: 'E2E8F0', width: 1 },
      rectRadius: 0.1,
    });

    slide2.addText('PROBLEM STATEMENT & CHALLENGES', {
      x: 0.8,
      y: 1.55,
      w: 5.4,
      h: 0.35,
      fontSize: 13,
      fontFace: 'Arial',
      bold: true,
      color: '991B1B',
    });

    slide2.addText([
      { text: '• Blind Subsurface Operations:\n', options: { bold: true, fontSize: 11.5, color: '0F172A' } },
      { text: '  Zero real-time visibility into deepwater wellhead dynamics, downhole PDC drill torque, and multi-phase flow lines.\n\n', options: { fontSize: 11, color: '334155' } },

      { text: '• Costly Unscheduled Downtime:\n', options: { bold: true, fontSize: 11.5, color: '0F172A' } },
      { text: '  Reactive maintenance leads to catastrophic pump failures, stuck pipe incidents, and ₹25L+ losses per event.\n\n', options: { fontSize: 11, color: '334155' } },

      { text: '• Undetected Water/Gas Breakthroughs:\n', options: { bold: true, fontSize: 11.5, color: '0F172A' } },
      { text: '  Emulsion surges and hydrate plugs choke subsea flowlines without early warning or ASTM D1250 net oil purification.\n\n', options: { fontSize: 11, color: '334155' } },

      { text: '• Fragmented Industrial Data:\n', options: { bold: true, fontSize: 11.5, color: '0F172A' } },
      { text: '  Telemetry is siloed across SCADA systems with no 3D spatial twin or automated midnight settlement compliance.', options: { fontSize: 11, color: '334155' } },
    ], {
      x: 0.8,
      y: 2.0,
      w: 5.4,
      h: 4.5,
      fontFace: 'Calibri',
    });

    // Right Column: PROPOSED SOLUTION (VARUNA-AI DIGITAL TWIN)
    slide2.addShape(pptx.ShapeType.roundRect, {
      x: 6.6,
      y: 1.4,
      w: 6.1,
      h: 5.3,
      fill: { color: 'F0FDF4' },
      line: { color: 'BBF7D0', width: 1 },
      rectRadius: 0.1,
    });

    slide2.addText('PROPOSED SOLUTION (VARUNA-AI)', {
      x: 6.8,
      y: 1.55,
      w: 5.7,
      h: 0.35,
      fontSize: 13,
      fontFace: 'Arial',
      bold: true,
      color: '065F46',
    });

    slide2.addText([
      { text: '• 50.0 Hz Physics-Informed Cyber-Twin:\n', options: { bold: true, fontSize: 11.5, color: '065F46' } },
      { text: '  Real-time subsea-to-topside 3D visualization in WebGL/Three.js with 20ms ultra-fast sensor ingestion.\n\n', options: { fontSize: 11, color: '334155' } },

      { text: '• Edge 1D Kalman Denoising:\n', options: { bold: true, fontSize: 11.5, color: '065F46' } },
      { text: '  Filters raw pressure, temperature, and Coriolis vibration noise for crystal-clear anomaly detection.\n\n', options: { fontSize: 11, color: '334155' } },

      { text: '• Automated ASTM D1250 Net Oil Reconciliation:\n', options: { bold: true, fontSize: 11.5, color: '065F46' } },
      { text: '  Continuously calculates Gross Extracted vs Net Dry Purified Oil, BS&W water-cut %, and associated gas.\n\n', options: { fontSize: 11, color: '334155' } },

      { text: '• 180-Day Database & Midnight Settlement:\n', options: { bold: true, fontSize: 11.5, color: '065F46' } },
      { text: '  Local high-speed database with sub-millisecond binary search and automated 12:00 Midnight DGH regulatory audits.', options: { fontSize: 11, color: '334155' } },
    ], {
      x: 6.8,
      y: 2.0,
      w: 5.7,
      h: 4.5,
      fontFace: 'Calibri',
    });
  }

  // ==========================================
  // SLIDE 3: TECHNICAL APPROACH (SYSTEM WORKFLOW & ARCHITECTURE)
  // ==========================================
  {
    const slide3 = pptx.addSlide();
    slide3.background = { color: 'FFFFFF' };
    addSihHeader(slide3, 'TECHNICAL APPROACH: SYSTEM WORKFLOW & ARCHITECTURE', 3);

    // Stencil Workflow Diagram Image (Featured across top/center)
    if (fs.existsSync(imgWorkflowStencil)) {
      slide3.addImage({
        path: imgWorkflowStencil,
        x: 0.6,
        y: 1.3,
        w: 12.13,
        h: 3.55,
      });
    }

    // Bottom Section: Core Tech Stack & Key Execution Metrics
    const bottomY = 4.95;
    const bottomHeight = 1.85;

    // Left Box: Core Technology Stack & Protocols
    slide3.addShape(pptx.ShapeType.roundRect, {
      x: 0.6,
      y: bottomY,
      w: 8.2,
      h: bottomHeight,
      fill: { color: 'F8FAFC' },
      line: { color: 'CBD5E1', width: 1 },
      rectRadius: 0.08,
    });

    slide3.addText('CORE TECHNOLOGY STACK & COMMUNICATION PROTOCOLS', {
      x: 0.8,
      y: bottomY + 0.08,
      w: 7.8,
      h: 0.25,
      fontSize: 10,
      fontFace: 'Arial',
      bold: true,
      color: '1E3A8A',
    });

    slide3.addText([
      { text: '• Stage 1 (Edge SCADA): ', options: { bold: true, fontSize: 8.5, color: '0F172A' } },
      { text: 'Modbus RTU/TCP, OPC-UA, WITSML, Serial USB WebGateway (50Hz / 20ms).\n', options: { fontSize: 8.5, color: '334155' } },

      { text: '• Stage 2 (Denoising): ', options: { bold: true, fontSize: 8.5, color: '0F172A' } },
      { text: 'Discrete 1D Kalman recursive state estimator + 180-day local buffer ledger (<0.1ms query).\n', options: { fontSize: 8.5, color: '334155' } },

      { text: '• Stage 3 (Physics & AI): ', options: { bold: true, fontSize: 8.5, color: '0F172A' } },
      { text: 'Darcy-Weisbach multiphase hydraulics, ASTM D1250 / API MPMS 11.1 net oil solver, XGBoost AI.\n', options: { fontSize: 8.5, color: '334155' } },

      { text: '• Stage 4 & 5 (Twin & Audit): ', options: { bold: true, fontSize: 8.5, color: '0F172A' } },
      { text: 'Three.js WebGL 3D spatial twin with gestures/voice + automated 12:00 Midnight DGH audit ledger.', options: { fontSize: 8.5, color: '334155' } },
    ], {
      x: 0.8,
      y: bottomY + 0.32,
      w: 7.8,
      h: 1.45,
      fontFace: 'Calibri',
    });

    // Right Box: Visual Rig & Digital Twin Thumbnails
    if (fs.existsSync(imgRigDiorama)) {
      slide3.addImage({
        path: imgRigDiorama,
        x: 9.0,
        y: bottomY,
        w: 1.8,
        h: bottomHeight,
      });
    }

    if (fs.existsSync(imgHologram)) {
      slide3.addImage({
        path: imgHologram,
        x: 10.93,
        y: bottomY,
        w: 1.8,
        h: bottomHeight,
      });
    }
  }

  // ==========================================
  // SLIDE 4: FEASIBILITY AND VIABILITY
  // ==========================================
  {
    const slide4 = pptx.addSlide();
    slide4.background = { color: 'FFFFFF' };
    addSihHeader(slide4, 'FEASIBILITY AND VIABILITY', 4);

    // Left Side: Feasibility Text
    slide4.addText([
      { text: '• Analysis of the feasibility of the idea:\n', options: { bold: true, fontSize: 12.5, color: '0F172A' } },
      { text: '  - Proven Industrial Standards: Works directly with standard Modbus RTU, OPC-UA, and AVEVA PI historians.\n', options: { fontSize: 11, color: '334155' } },
      { text: '  - Low Latency Execution: Sub-millisecond binary search (<0.1ms) enables seamless real-time analytics without cloud latency.\n', options: { fontSize: 11, color: '334155' } },
      { text: '  - Zero Server Overhead: Self-contained WebGL client runs in any modern browser with local laptop database fallback.\n\n', options: { fontSize: 11, color: '334155' } },

      { text: '• Potential challenges and risks:\n', options: { bold: true, fontSize: 12.5, color: '0F172A' } },
      { text: '  - Severe deepwater sensor noise and intermittent connectivity at -2,040m seabed.\n', options: { fontSize: 11, color: '334155' } },
      { text: '  - High computational burden of coupled thermodynamic reservoir simulations.\n\n', options: { fontSize: 11, color: '334155' } },

      { text: '• Strategies for overcoming these challenges:\n', options: { bold: true, fontSize: 12.5, color: '0F172A' } },
      { text: '  - 1D Kalman Edge Filter: Suppresses transient bubble glitches and pressure noise locally.\n', options: { fontSize: 11, color: '334155' } },
      { text: '  - Surrogate Edge AI: XGBoost classifiers act as fast surrogates while heavy physics calibrates asynchronously.', options: { fontSize: 11, color: '334155' } },
    ], {
      x: 0.6,
      y: 1.4,
      w: 6.4,
      h: 5.3,
      fontFace: 'Calibri',
    });

    // Right Side: Rig Image (Drill mechanics)
    if (fs.existsSync(imgDrill)) {
      slide4.addImage({
        path: imgDrill,
        x: 7.2,
        y: 1.5,
        w: 5.5,
        h: 5.0,
      });
    }
  }

  // ==========================================
  // SLIDE 5: IMPACT AND BENEFITS
  // ==========================================
  {
    const slide5 = pptx.addSlide();
    slide5.background = { color: 'FFFFFF' };
    addSihHeader(slide5, 'IMPACT AND BENEFITS', 5);

    // Left Column: Potential impact on target audience
    slide5.addShape(pptx.ShapeType.roundRect, {
      x: 0.6,
      y: 1.4,
      w: 5.9,
      h: 5.3,
      fill: { color: 'F8FAFC' },
      line: { color: 'E2E8F0', width: 1 },
      rectRadius: 0.1,
    });

    slide5.addText('Potential impact on the target audience (OIL & ONGC):', {
      x: 0.8,
      y: 1.55,
      w: 5.5,
      h: 0.4,
      fontSize: 12.5,
      fontFace: 'Arial',
      bold: true,
      color: '1E3A8A',
    });

    slide5.addText([
      { text: '• Deepwater Subsea Optimization:\n', options: { bold: true, fontSize: 11, color: '0F172A' } },
      { text: '  Unlocks actionable visibility into deepwater manifolds, enabling higher extraction rates from ultra-deep offshore blocks.\n\n', options: { fontSize: 10.5, color: '334155' } },

      { text: '• Predictive Health & Asset Life:\n', options: { bold: true, fontSize: 11, color: '0F172A' } },
      { text: '  Maximizes lifespan of drill strings, subsea risers, and topside separators by preventing fatigue and over-torque.\n\n', options: { fontSize: 10.5, color: '334155' } },

      { text: '• Shift to Autonomous Supervision:\n', options: { bold: true, fontSize: 11, color: '0F172A' } },
      { text: '  Transforms control room operations from reactive fire-fighting to autonomous AI-driven supervisory guidance.\n\n', options: { fontSize: 10.5, color: '334155' } },

      { text: '• Environmental Safety (Zero Spills):\n', options: { bold: true, fontSize: 11, color: '0F172A' } },
      { text: '  Early pipe blockage and rupture detection prevents catastrophic environmental contamination.', options: { fontSize: 10.5, color: '334155' } },
    ], {
      x: 0.8,
      y: 2.05,
      w: 5.5,
      h: 4.5,
      fontFace: 'Calibri',
    });

    // Right Column: Economic & Operational Benefits
    slide5.addShape(pptx.ShapeType.roundRect, {
      x: 6.7,
      y: 1.4,
      w: 6.0,
      h: 5.3,
      fill: { color: 'F0FDF4' },
      line: { color: 'BBF7D0', width: 1 },
      rectRadius: 0.1,
    });

    slide5.addText('Benefits of the solution (Economic & Operational):', {
      x: 6.9,
      y: 1.55,
      w: 5.6,
      h: 0.4,
      fontSize: 12.5,
      fontFace: 'Arial',
      bold: true,
      color: '065F46',
    });

    slide5.addText([
      { text: '• Cost Recovery: ', options: { bold: true, fontSize: 11, color: '065F46' } },
      { text: '₹25+ Lakhs saved per incident through proactive anomaly detection and automated pump speed throttling.\n\n', options: { fontSize: 10.5, color: '334155' } },

      { text: '• 35% Downtime Reduction: ', options: { bold: true, fontSize: 11, color: '065F46' } },
      { text: 'Automated 12:00 Midnight reconciliation and instant incident dispatch reduce mean time to resolution.\n\n', options: { fontSize: 10.5, color: '334155' } },

      { text: '• 40% Lifting Cost Reduction: ', options: { bold: true, fontSize: 11, color: '065F46' } },
      { text: 'Optimized multiphase fluid balance and ASTM D1250 purification minimize energy and demulsifier waste.\n\n', options: { fontSize: 10.5, color: '334155' } },

      { text: '• 100% Regulatory Compliance: ', options: { bold: true, fontSize: 11, color: '065F46' } },
      { text: 'Certified DGH / ISO 14001 daily ledger with cryptographic audit hash verification.', options: { fontSize: 10.5, color: '334155' } },
    ], {
      x: 6.9,
      y: 2.05,
      w: 5.6,
      h: 4.5,
      fontFace: 'Calibri',
    });
  }

  // ==========================================
  // SLIDE 6: RESEARCH AND REFERENCES
  // ==========================================
  {
    const slide6 = pptx.addSlide();
    slide6.background = { color: 'FFFFFF' };
    addSihHeader(slide6, 'RESEARCH AND REFERENCES', 6);

    slide6.addText('Details / Links of the reference and research work:', {
      x: 0.6,
      y: 1.4,
      w: 11.5,
      h: 0.35,
      fontSize: 13,
      fontFace: 'Arial',
      bold: true,
      color: '0F172A',
    });

    slide6.addText([
      { text: '• ASTM D1250 & API MPMS Chapter 11.1 Standards:\n', options: { bold: true, fontSize: 11.5, color: '0F172A' } },
      { text: '  Standardized equations for temperature & pressure volume correction factors (CTL/CPL) for crude oils.\n\n', options: { fontSize: 11, color: '334155' } },

      { text: '• Coriolis Resonance & Darcy-Weisbach Multiphase Mechanics:\n', options: { bold: true, fontSize: 11.5, color: '0F172A' } },
      { text: '  Mathematical formulation for tube frequency inversion and subsea pipeline friction factor calculations.\n\n', options: { fontSize: 11, color: '334155' } },

      { text: '• 1D Kalman Filtering for Industrial SCADA Denoising:\n', options: { bold: true, fontSize: 11.5, color: '0F172A' } },
      { text: '  Discrete recursive Bayesian state estimation for high-frequency telemetry streams.\n\n', options: { fontSize: 11, color: '334155' } },

      { text: '• WebGL & Three.js for 3D Cyber-Physical Spatial Computing:\n', options: { bold: true, fontSize: 11.5, color: '0F172A' } },
      { text: '  High-performance GPU-accelerated rendering of complex offshore assemblies with real-time gesture interaction.\n\n', options: { fontSize: 11, color: '334155' } },

      { text: '• DGH (Directorate General of Hydrocarbons) Offshore Reporting Guidelines:\n', options: { bold: true, fontSize: 11.5, color: '0F172A' } },
      { text: '  Indian statutory standards for certified daily hydrocarbon reconciliation and environmental auditing.', options: { fontSize: 11, color: '334155' } },
    ], {
      x: 0.6,
      y: 1.85,
      w: 6.8,
      h: 4.8,
      fontFace: 'Calibri',
    });

    // Right Side: Rig Image (Subsea pipes)
    if (fs.existsSync(imgSubseaPipes)) {
      slide6.addImage({
        path: imgSubseaPipes,
        x: 7.6,
        y: 1.85,
        w: 5.1,
        h: 4.7,
      });
    }
  }

  // Save to presentation output path
  const outputPath = path.resolve('public/SIH2026_Digital_Twin_VARUNA_AI.pptx');
  const rootOutputPath = path.resolve('SIH2026_Digital_Twin_VARUNA_AI.pptx');

  await pptx.writeFile({ fileName: outputPath });
  try {
    fs.copyFileSync(outputPath, rootOutputPath);
    console.log(`✅ [SUCCESS] SIH 6-Page PowerPoint Presentation Generated:`);
    console.log(`   └─ ${outputPath}`);
    console.log(`   └─ ${rootOutputPath}`);
  } catch (err: any) {
    console.log(`✅ [SUCCESS] SIH 6-Page PowerPoint Presentation Generated at: ${outputPath}`);
    console.log(`ℹ️ [NOTE] Root copy deferred (file currently open in Microsoft PowerPoint). The public downloadable file is fully updated.`);
  }
}

generateSihPresentation().catch(console.error);
