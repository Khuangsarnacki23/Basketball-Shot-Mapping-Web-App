import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerSummaryComponent } from './player-summary.component';
import { routing } from 'app/player-summary/player-summary.routing';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { FlexModule } from '@angular/flex-layout';
import { MatListModule } from '@angular/material/list';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PlayersService } from 'app/_services/players.service';

@NgModule({
  declarations: [PlayerSummaryComponent],
  imports: [
    CommonModule,
    routing,
    MatToolbarModule,
    MatCardModule,
    FlexModule,
    MatListModule,
    MatRadioModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatOptionModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  providers: [PlayersService],
  bootstrap: [PlayerSummaryComponent],
})
export class PlayerSummaryModule {}

   export namespace PlayerSummaryModule {
    export type ActionType = 'shot' | 'pass' | 'turnover';
    export type HalfcourtAction = 'Pick & Roll' | 'Isolation' | 'Post-up' | 'Off-Ball Screen';
  
    export type DataOrientation = 'asDiagram' | 'negateX' | 'negateY' | 'negateBoth';
    export class CourtCoords {
      static ORIENTATION: DataOrientation = 'asDiagram';
      static normalize(x: number, y: number) {
        switch (this.ORIENTATION) {
          case 'negateX': return { x: -x, y };
          case 'negateY': return { x, y: -y };
          case 'negateBoth': return { x: -x, y: -y };
          default: return { x, y };
        }
      }
    }
  
    export class CourtGeometry {
      static readonly PX_PER_FT = 10;
      static readonly COURT_LENGTH_FT = 47.0;
      static readonly COURT_WIDTH_FT  = 50;
      static readonly Y_MIN_FT        = -4.0;  
      static readonly Y_MAX_FT        = 47.0;  
  
      static readonly VIEW_W = CourtGeometry.COURT_WIDTH_FT * CourtGeometry.PX_PER_FT;
      static readonly VIEW_H = (CourtGeometry.Y_MAX_FT - CourtGeometry.Y_MIN_FT) * CourtGeometry.PX_PER_FT;
  
      static readonly HOOP_RADIUS_FT       = 0.75;
      static readonly RESTRICTED_RADIUS_FT = 4.0;
      static readonly LANE_WIDTH_FT        = 16.0;
      static readonly FT_CIRCLE_RADIUS_FT  = 6.0;
      static readonly FT_CIRCLE_CENTER_Y_FT = 13.5; 
  
      static readonly CORNER_3_FT        = 22.0;  
      static readonly ARC_RADIUS_FT      = 23.75;
      static readonly CORNER_BREAK_Y_FT  = 7.8;  
  
      static toSvgX(xFt: number) { return (xFt + CourtGeometry.COURT_WIDTH_FT / 2) * CourtGeometry.PX_PER_FT; }
      static toSvgY(yFt: number) { return (CourtGeometry.Y_MAX_FT - yFt) * CourtGeometry.PX_PER_FT; }
  
      static distanceFromHoopFt(x: number, y: number) { return Math.hypot(x, y); }
  
      // Above-the-break vs corner three
      static isThree(x: number, y: number): boolean {
        const ax = Math.abs(x);
        const r  = Math.hypot(x, y);
        if (ax >= this.CORNER_3_FT && y <= this.CORNER_BREAK_Y_FT) return true;       // corner strip
        if (r >= this.ARC_RADIUS_FT && y > this.CORNER_BREAK_Y_FT) return true;        // above-the-break
        return false;
      }
  
      // Shot bucketing aligned to the new spec
      static shotZone(
        x: number, y: number
      ): 'Corner Three' | 'Above-the-Break Three' | 'Left Midrange' | 'Right Midrange' | 'Elbow/FT' | 'Inner Paint' | 'Undefined' {
        const ax = Math.abs(x);
        const r  = Math.hypot(x, y);
        const EPS = 0.15;
  
        // 1) Inner paint: box from y=0 up to FT circle center (lane width 16)
        if (ax <= this.LANE_WIDTH_FT / 2 && y >= 0 && y <= this.FT_CIRCLE_CENTER_Y_FT + EPS) {
          return 'Inner Paint';
        }
  
        // 2) Corners: |x| >= 22 and y <= 7.8
        if (ax >= this.CORNER_3_FT - EPS && y <= this.CORNER_BREAK_Y_FT + EPS) {
          return 'Corner Three';
        }
  
        // 3) Above-the-break: outside the 23.75' arc and above the break
        if (r >= this.ARC_RADIUS_FT - EPS && y > this.CORNER_BREAK_Y_FT + EPS) {
          return 'Above-the-Break Three';
        }

        // 2-pt test: inside the 3PT boundary (corner flats OR above-the-break arc)
        const insideCornerFlat = y <= this.CORNER_BREAK_Y_FT + EPS && Math.abs(x) <= this.CORNER_3_FT + EPS;
        const insideArc = r <= this.ARC_RADIUS_FT + EPS;
        const isTwoPoint = insideCornerFlat || insideArc;

        if (!isTwoPoint) {
          return 'Undefined';
        }

        const thetaElbow = Math.atan2(this.FT_CIRCLE_CENTER_Y_FT, this.LANE_WIDTH_FT / 2);
        const alpha = (Math.PI / 2) - thetaElbow;  
        const ang = Math.atan2(y, x); 
        let diff = Math.abs(ang - Math.PI / 2);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;

        if (diff <= alpha + 1e-3) {
          return 'Elbow/FT';
        }

        //If not defined as Elbow/Ft or outside of the Undefined region (inside 2pt line)
        return x < 0 ? 'Left Midrange' : 'Right Midrange';

      }
  
      static ftTopPath(): string {
        const r  = this.FT_CIRCLE_RADIUS_FT * this.PX_PER_FT;
        const cy = this.toSvgY(this.FT_CIRCLE_CENTER_Y_FT);
        const xR = this.toSvgX( 6), xL = this.toSvgX(-6);
        // Right→Left, sweep=1 draws the top arc in y-down SVG
        return `M ${xR} ${cy} A ${r} ${r} 0 0 1 ${xL} ${cy}`;
      }
      static ftBottomPath(): string {
        const r  = this.FT_CIRCLE_RADIUS_FT * this.PX_PER_FT;
        const cy = this.toSvgY(this.FT_CIRCLE_CENTER_Y_FT);
        const xL = this.toSvgX(-6), xR = this.toSvgX( 6);
        return `M ${xL} ${cy} A ${r} ${r} 0 0 1 ${xR} ${cy}`;
      }
      static threeArcPath(): string {
        const y  = this.CORNER_BREAK_Y_FT;
        const r  = this.ARC_RADIUS_FT * this.PX_PER_FT;
        const xL = this.toSvgX(-this.CORNER_3_FT), xR = this.toSvgX(this.CORNER_3_FT);
        const sy = this.toSvgY(y);
        return `M ${xL} ${sy} A ${r} ${r} 0 0 1 ${xR} ${sy}`;
      }
    }
  
    export interface PlayerInit { id: number; name: string; team?: string; }

    export class Player {
      id: number;
      name: string;
      team?: string;

      constructor(initOrId: PlayerInit | number, name?: string, team?: string) {
        if (typeof initOrId === 'number') {
          this.id = initOrId;
          this.name = name ?? '';
          this.team = team;
        } else {
          this.id = initOrId.id;
          this.name = initOrId.name;
          this.team = initOrId.team;
        }
      }
    }
    export interface CourtEventInit {
      playerId: number;
      x: number; y: number;
      actionType: ActionType;
      halfcourtAction?: HalfcourtAction;
      made?: boolean;
      timestamp?: string | number;
    }
    export class CourtEvent {
      playerId: number; x: number; y: number;
      actionType: ActionType;
      halfcourtAction?: HalfcourtAction;
      made: boolean;
      timestamp?: string | number;
      constructor(i: CourtEventInit) {
        this.playerId = i.playerId;
        this.x = i.x; this.y = i.y;
        this.actionType = i.actionType;
        this.halfcourtAction = i.halfcourtAction;
        this.made = !!i.made;
        this.timestamp = i.timestamp;
      }
      get svgX() { return CourtGeometry.toSvgX(this.x); }
      get svgY() { return CourtGeometry.toSvgY(this.y); }
      get distanceFromHoopFt() { return CourtGeometry.distanceFromHoopFt(this.x, this.y); }
      get zone() { return CourtGeometry.shotZone(this.x, this.y); }
    }
  
    export type CountKeys =
      | 'totalShotAttempts' | 'totalPoints' | 'totalPasses' | 'totalPotentialAssists'
      | 'totalTurnovers' | 'totalPassingTurnovers'
      | 'pickAndRollCount' | 'isolationCount' | 'postUpCount' | 'offBallScreenCount';
  
    export class PlayerSummary {
      constructor(
        public player: Player,
        public counts: Record<CountKeys, number>,
        public ranks?: Record<`${CountKeys}Rank`, number>,
      ) {}
      static emptyCounts(): Record<CountKeys, number> {
        return {
          totalShotAttempts: 0, totalPoints: 0, totalPasses: 0, totalPotentialAssists: 0,
          totalTurnovers: 0, totalPassingTurnovers: 0,
          pickAndRollCount: 0, isolationCount: 0, postUpCount: 0, offBallScreenCount: 0,
        };
      }
      static fromEvents(player: Player, events: CourtEvent[]): PlayerSummary {
        const c = PlayerSummary.emptyCounts();
        for (const e of events) {
          if (e.playerId !== player.id) continue;
          if (e.actionType === 'shot') {
            c.totalShotAttempts++;
            if (e.made) c.totalPoints += CourtGeometry.isThree(e.x, e.y) ? 3 : 2;
          } else if (e.actionType === 'pass') c.totalPasses++;
          else if (e.actionType === 'turnover') c.totalTurnovers++;
          switch (e.halfcourtAction) {
            case 'Pick & Roll': c.pickAndRollCount++; break;
            case 'Isolation': c.isolationCount++; break;
            case 'Post-up': c.postUpCount++; break;
            case 'Off-Ball Screen': c.offBallScreenCount++; break;
          }
        }
        return new PlayerSummary(player, c);
      }
      static withRanks(all: PlayerSummary[]): PlayerSummary[] {
        const keys: CountKeys[] = [
          'totalShotAttempts','totalPoints','totalPasses','totalPotentialAssists',
          'totalTurnovers','totalPassingTurnovers','pickAndRollCount','isolationCount',
          'postUpCount','offBallScreenCount',
        ];
        const sorted: Record<CountKeys, PlayerSummary[]> = {} as any;
        for (const k of keys) sorted[k] = [...all].sort((a,b)=>b.counts[k]-a.counts[k]);
        return all.map(ps => {
          const ranks = {} as Record<`${CountKeys}Rank`, number>;
          for (const k of keys) ranks[`${k}Rank`] = sorted[k].findIndex(s => s.player.id === ps.player.id) + 1;
          return new PlayerSummary(ps.player, { ...ps.counts }, ranks);
        });
      }
    }
  }
  