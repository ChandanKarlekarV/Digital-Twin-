/**
 * Real-Time 1D Discrete Kalman Filter
 * Denoises high-frequency telemetry fluctuations and rejects sensor dropouts/spikes.
 */

export interface KalmanFilterConfig {
  A?: number; // State transition (default: 1.0)
  B?: number; // Control matrix (default: 0.0)
  H?: number; // Measurement matrix (default: 1.0)
  Q?: number; // Process noise covariance (default: 1e-3)
  R?: number; // Measurement noise covariance (default: 1e-1)
  initialState?: number;
  initialCovariance?: number;
  maxResidualThreshold?: number; // Outlier spike rejection threshold
}

export interface KalmanFilterState {
  raw: number;
  filtered: number;
  covariance: number;
  kalmanGain: number;
  innovation: number;
  isOutlier: boolean;
}

export class KalmanFilter1D {
  private A: number;
  private B: number;
  private H: number;
  private Q: number;
  private R: number;
  private x: number; // State estimate
  private P: number; // Error covariance
  private maxResidualThreshold: number;

  constructor(config: KalmanFilterConfig = {}) {
    this.A = config.A ?? 1.0;
    this.B = config.B ?? 0.0;
    this.H = config.H ?? 1.0;
    this.Q = config.Q ?? 0.005;
    this.R = config.R ?? 0.08;
    this.x = config.initialState ?? 0.0;
    this.P = config.initialCovariance ?? 1.0;
    this.maxResidualThreshold = config.maxResidualThreshold ?? 100.0;
  }

  /**
   * Reset filter to initial value.
   */
  public reset(initialState: number, initialCovariance = 1.0): void {
    this.x = initialState;
    this.P = initialCovariance;
  }

  /**
   * Update filter with a new noisy sensor reading z_k.
   */
  public update(z: number, u = 0): KalmanFilterState {
    // 1. Time Update (Predict)
    const xPrior = this.A * this.x + this.B * u;
    const pPrior = this.A * this.P * this.A + this.Q;

    // Innovation residual
    const innovation = z - this.H * xPrior;
    const isOutlier = Math.abs(innovation) > this.maxResidualThreshold;

    // If extreme outlier (e.g. communication dropout / zero clipping), rely on state projection
    if (isOutlier) {
      this.x = xPrior;
      this.P = pPrior;
      return {
        raw: z,
        filtered: this.x,
        covariance: this.P,
        kalmanGain: 0,
        innovation,
        isOutlier: true,
      };
    }

    // 2. Measurement Update (Correct)
    const S = this.H * pPrior * this.H + this.R;
    const K = (pPrior * this.H) / S; // Kalman Gain

    this.x = xPrior + K * innovation;
    this.P = (1.0 - K * this.H) * pPrior;

    return {
      raw: z,
      filtered: this.x,
      covariance: this.P,
      kalmanGain: K,
      innovation,
      isOutlier: false,
    };
  }

  public getState(): number {
    return this.x;
  }

  public getCovariance(): number {
    return this.P;
  }
}
