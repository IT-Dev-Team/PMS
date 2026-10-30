// lib/services/financial.service.ts
import { FinancialQueries } from '@/lib/db/queries/financial';
import { ProjectQueries } from '@/lib/db/queries/projects';
import { EVMCalculator } from '@/lib/utils/evm-calculator';
import { FinancialMetrics, EVMSnapshot, Forecast } from '@/types/financial';

export class FinancialService {
  
  // ========== CALCULATE EVM METRICS ==========
  static async calculateEVMMetrics(projectId: string): Promise<any> {
    try {
      const [project, evmData, budgetItems, actualCosts] = await Promise.all([
        ProjectQueries.findById(projectId),
        FinancialQueries.getEVMData(projectId),
        FinancialQueries.getBudgetLineItems(projectId),
        FinancialQueries.getActualCosts(projectId)
      ]);

      const totalBudget = budgetItems?.reduce((sum: number, item: any) => sum + (item.plannedAmount || 0), 0) || 0;
      const totalActual = actualCosts?.reduce((sum: number, cost: any) => sum + (cost.amount || 0), 0) || 0;
      
      // Calculate EVM metrics
      const pv = EVMCalculator.calculatePV(project, totalBudget);
      const ev = EVMCalculator.calculateEV(project, totalBudget);
      const ac = totalActual;
      const cpi = EVMCalculator.calculateCPI(ev, ac);
      const spi = EVMCalculator.calculateSPI(ev, pv);
      const eac = EVMCalculator.calculateEAC(ac, ev, totalBudget);
      const etc = EVMCalculator.calculateETC(ac, ev, totalBudget);
      const vac = EVMCalculator.calculateVAC(totalBudget, ev, ac);

      return {
        budget: {
          total: totalBudget,
          utilized: totalActual,
          remaining: totalBudget - totalActual,
          utilizationPercent: totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0
        },
        evm: {
          pv,
          ev,
          ac,
          cpi,
          spi,
          eac,
          etc,
          vac
        },
        forecast: {
          eac,
          etc,
          vac,
          confidence: 80
        },
        health: {
          cost: this.getCostHealth(cpi),
          schedule: this.getScheduleHealth(spi),
          overall: this.getOverallHealth(cpi, spi)
        }
      };
    } catch (error) {
      console.error('Error calculating EVM metrics:', error);
      return {
        budget: { total: 0, utilized: 0, remaining: 0, utilizationPercent: 0 },
        evm: { pv: 0, ev: 0, ac: 0, cpi: 0, spi: 0, eac: 0, etc: 0, vac: 0 },
        forecast: { eac: 0, etc: 0, vac: 0, confidence: 0 },
        health: { cost: 'RED', schedule: 'RED', overall: 'RED' }
      };
    }
  }

  // ========== HEALTH INDICATORS ==========
  static getCostHealth(cpi: number): 'GREEN' | 'AMBER' | 'RED' {
    if (cpi >= 1) return 'GREEN';
    if (cpi >= 0.8) return 'AMBER';
    return 'RED';
  }

  static getScheduleHealth(spi: number): 'GREEN' | 'AMBER' | 'RED' {
    if (spi >= 1) return 'GREEN';
    if (spi >= 0.8) return 'AMBER';
    return 'RED';
  }

  static getOverallHealth(cpi: number, spi: number): 'GREEN' | 'AMBER' | 'RED' {
    const costHealth = this.getCostHealth(cpi);
    const scheduleHealth = this.getScheduleHealth(spi);
    
    if (costHealth === 'RED' || scheduleHealth === 'RED') return 'RED';
    if (costHealth === 'AMBER' || scheduleHealth === 'AMBER') return 'AMBER';
    return 'GREEN';
  }

  // ========== GENERATE FORECAST ==========
  static async generateForecast(projectId: string): Promise<any> {
    try {
      const metrics = await this.calculateEVMMetrics(projectId);
      const evm = metrics.evm || {};
      
      return {
        projectId,
        period: new Date(),
        etc: evm.etc || 0,
        eac: evm.eac || 0,
        vac: evm.vac || 0,
        confidenceLevel: 80,
        scenario: 'MOST_LIKELY',
        assumptions: 'Based on current performance trends',
        createdBy: null
      };
    } catch (error) {
      console.error('Error generating forecast:', error);
      return {
        projectId,
        period: new Date(),
        etc: 0,
        eac: 0,
        vac: 0,
        confidenceLevel: 0,
        scenario: 'MOST_LIKELY',
        assumptions: 'Unable to generate forecast'
      };
    }
  }
}