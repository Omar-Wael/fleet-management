import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Renders like a vehicle's own instrument cluster needle — deliberately
 * tying the dashboard's one signature visual to the subject matter
 * (fleet vehicles) rather than a generic donut/gauge library widget.
 * Sweeps from -120deg (0%) to +120deg (100%) across a 240deg arc.
 */

@Component({
  selector: 'app-fleet-gauge',
  imports: [],
  templateUrl: './fleet-gauge.html',
  styleUrl: './fleet-gauge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetGauge {
  /** 0-100 */
  @Input() value = 0;
  @Input() label = 'Fleet operational';

  private readonly startAngle = -120; // degrees, 0%
  private readonly endAngle = 120; // degrees, 100%
  private readonly radius = 80;
  private readonly cx = 100;
  private readonly cy = 100;

  private toPoint(percent: number): { x: number; y: number } {
    const angleDeg = this.startAngle + (percent / 100) * (this.endAngle - this.startAngle);
    const angleRad = (angleDeg * Math.PI) / 180;
    // -90deg offset so 0deg points straight up in standard SVG coordinates
    return {
      x: this.cx + this.radius * Math.sin(angleRad),
      y: this.cy - this.radius * Math.cos(angleRad),
    };
  }

  arcPath(fromPercent: number, toPercent: number): string {
    const start = this.toPoint(fromPercent);
    const end = this.toPoint(toPercent);
    const sweepDeg = (toPercent - fromPercent) * ((this.endAngle - this.startAngle) / 100);
    const largeArcFlag = sweepDeg > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${this.radius} ${this.radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  }

  needleTip(): { x: number; y: number } {
    const clamped = Math.max(0, Math.min(100, this.value));
    const point = this.toPoint(clamped);
    // Needle is shorter than the arc radius so it doesn't overshoot the track.
    const needleLength = this.radius - 18;
    const angleDeg = this.startAngle + (clamped / 100) * (this.endAngle - this.startAngle);
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      x: this.cx + needleLength * Math.sin(angleRad),
      y: this.cy - needleLength * Math.cos(angleRad),
    };
  }
}
