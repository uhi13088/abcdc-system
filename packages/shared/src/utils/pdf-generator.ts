/**
 * PDF 생성 유틸리티
 * 계약서, 급여명세서, 손익계산서 등 PDF 생성
 */

import PDFDocument from 'pdfkit';
import { Salary, Contract, LaborLawVersion } from '../types/entities';

// 한글 폰트 경로 (프로젝트에 맞게 조정 필요)
const KOREAN_FONT_PATH = process.env.KOREAN_FONT_PATH || '/fonts/NotoSansKR-Regular.otf';

export interface ProfitLossStatement {
  companyId: string;
  companyName: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  revenue: {
    sales: number;
    otherIncome: number;
    total: number;
  };
  expenses: {
    costOfGoodsSold: number;
    laborCost: number;
    rent: number;
    utilities: number;
    marketing: number;
    depreciation: number;
    other: number;
    total: number;
  };
  grossProfit: number;
  operatingProfit: number;
  netProfit: number;
  profitMargin: number;
  breakdown?: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  generatedAt: Date;
}

export interface ContractPDFData extends Contract {
  companyName: string;
  companyAddress: string;
  companyBusinessNumber: string;
  companyCeoName: string;
  staffName: string;
  staffAddress: string;
  staffPhone: string;
  staffSSN?: string;
}

export class PDFGenerator {
  private static createDocument(): PDFKit.PDFDocument {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
    });

    // 한글 폰트 등록 시도
    try {
      doc.registerFont('Korean', KOREAN_FONT_PATH);
      doc.font('Korean');
    } catch {
      // 폰트가 없으면 기본 폰트 사용
      doc.font('Helvetica');
    }

    return doc;
  }

  private static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  }

  private static formatDate(date: Date): string {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  }

  private static maskSSN(ssn: string): string {
    if (!ssn || ssn.length < 14) return '******-*******';
    return ssn.substring(0, 8) + '******';
  }

  /**
   * 급여명세서 PDF 생성
   */
  static async generatePayslip(salary: Salary & {
    staffName: string;
    staffEmail?: string;
    companyName: string;
    position?: string;
    department?: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = this.createDocument();
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // 제목
        doc.fontSize(20).text('급 여 명 세 서', { align: 'center' });
        doc.moveDown(2);

        // 기본 정보
        doc.fontSize(12);
        doc.text(`지급년월: ${salary.year}년 ${salary.month}월`, { align: 'right' });
        doc.moveDown();

        // 직원 정보
        doc.fontSize(14).text('1. 인적사항');
        doc.moveDown(0.5);
        doc.fontSize(11);
        doc.text(`성명: ${salary.staffName}`);
        doc.text(`소속: ${salary.companyName}`);
        if (salary.department) doc.text(`부서: ${salary.department}`);
        if (salary.position) doc.text(`직위: ${salary.position}`);
        doc.text(`근무일수: ${salary.workDays}일 / 총 ${salary.totalHours}시간`);
        doc.moveDown();

        // 지급 내역
        doc.fontSize(14).text('2. 지급 내역');
        doc.moveDown(0.5);
        doc.fontSize(11);

        const earnings = [
          ['기본급', salary.baseSalary],
          ['연장근로수당', salary.overtimePay],
          ['야간근로수당', salary.nightPay],
          ['휴일근로수당', salary.holidayPay],
          ['주휴수당', salary.weeklyHolidayPay],
          ['식대', salary.mealAllowance],
          ['교통비', salary.transportAllowance],
          ['직책수당', salary.positionAllowance],
        ];

        earnings.forEach(([label, amount]) => {
          if (amount && amount > 0) {
            doc.text(`${label}: ${this.formatCurrency(amount as number)}`, { indent: 20 });
          }
        });

        if (salary.otherAllowances) {
          Object.entries(salary.otherAllowances).forEach(([key, value]) => {
            if (value && value > 0) {
              doc.text(`${key}: ${this.formatCurrency(value)}`, { indent: 20 });
            }
          });
        }

        doc.moveDown(0.5);
        doc.fontSize(12).text(`총 지급액: ${this.formatCurrency(salary.totalGrossPay)}`, { indent: 20 });
        doc.moveDown();

        // 공제 내역
        doc.fontSize(14).text('3. 공제 내역');
        doc.moveDown(0.5);
        doc.fontSize(11);

        const deductions = [
          ['국민연금', salary.nationalPension],
          ['건강보험', salary.healthInsurance],
          ['장기요양보험', salary.longTermCare],
          ['고용보험', salary.employmentInsurance],
          ['소득세', salary.incomeTax],
          ['지방소득세', salary.localIncomeTax],
        ];

        deductions.forEach(([label, amount]) => {
          if (amount && amount > 0) {
            doc.text(`${label}: ${this.formatCurrency(amount as number)}`, { indent: 20 });
          }
        });

        if (salary.otherDeductions) {
          Object.entries(salary.otherDeductions).forEach(([key, value]) => {
            if (value && value > 0) {
              doc.text(`${key}: ${this.formatCurrency(value)}`, { indent: 20 });
            }
          });
        }

        doc.moveDown(0.5);
        doc.fontSize(12).text(`총 공제액: ${this.formatCurrency(salary.totalDeductions)}`, { indent: 20 });
        doc.moveDown(1.5);

        // 실수령액
        doc.fontSize(16).text(`실수령액: ${this.formatCurrency(salary.netPay)}`, { align: 'center' });
        doc.moveDown(2);

        // 확정 정보
        if (salary.confirmedAt) {
          doc.fontSize(10).text(`확정일시: ${this.formatDate(salary.confirmedAt)}`);
        }
        if (salary.paidAt) {
          doc.text(`지급일시: ${this.formatDate(salary.paidAt)}`);
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 근로계약서 PDF 생성
   */
  static async generateContract(contract: ContractPDFData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = this.createDocument();
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // 제목
        doc.fontSize(22).text('근 로 계 약 서', { align: 'center' });
        doc.moveDown(2);

        // 계약 당사자 정보
        doc.fontSize(12);
        doc.text('사용자(갑)와 근로자(을)는 아래와 같이 근로계약을 체결한다.');
        doc.moveDown(1.5);

        // 사용자 정보
        doc.fontSize(14).text('【 사용자(갑) 】');
        doc.fontSize(11);
        doc.text(`사업장명: ${contract.companyName}`);
        doc.text(`사업자등록번호: ${contract.companyBusinessNumber || '-'}`);
        doc.text(`대표자명: ${contract.companyCeoName || '-'}`);
        doc.text(`사업장 소재지: ${contract.companyAddress || '-'}`);
        doc.moveDown();

        // 근로자 정보
        doc.fontSize(14).text('【 근로자(을) 】');
        doc.fontSize(11);
        doc.text(`성명: ${contract.staffName}`);
        doc.text(`주민등록번호: ${this.maskSSN(contract.staffSSN || '')}`);
        doc.text(`주소: ${contract.staffAddress || '-'}`);
        doc.text(`연락처: ${contract.staffPhone || '-'}`);
        doc.moveDown(1.5);

        // 제1조 계약기간
        doc.fontSize(14).text('제1조 【계약기간】');
        doc.fontSize(11);
        const startDate = this.formatDate(contract.startDate);
        const endDate = contract.endDate ? this.formatDate(contract.endDate) : '정함이 없음';
        doc.text(`계약기간: ${startDate} ~ ${endDate}`);
        if (contract.probationMonths && contract.probationMonths > 0) {
          doc.text(`수습기간: ${contract.probationMonths}개월`);
        }
        doc.moveDown();

        // 제2조 근무장소 및 업무
        doc.fontSize(14).text('제2조 【근무장소 및 업무내용】');
        doc.fontSize(11);
        if (contract.department) doc.text(`부서: ${contract.department}`);
        if (contract.position) doc.text(`직위: ${contract.position}`);
        doc.text(`담당업무: ${contract.duties?.join(', ') || '-'}`);
        doc.moveDown();

        // 제3조 근로시간
        doc.fontSize(14).text('제3조 【근로시간】');
        doc.fontSize(11);
        doc.text(`1일 근로시간: ${contract.standardHoursPerDay}시간`);
        doc.text(`주당 근로시간: ${contract.standardHoursPerWeek}시간`);
        doc.text(`휴게시간: ${contract.breakMinutes}분`);
        if (contract.workSchedules && contract.workSchedules.length > 0) {
          const schedule = contract.workSchedules[0];
          const days = schedule.daysOfWeek.map(d => ['일', '월', '화', '수', '목', '금', '토'][d]).join(', ');
          doc.text(`근무요일: ${days}`);
          doc.text(`근무시간: ${schedule.startTime} ~ ${schedule.endTime}`);
        }
        doc.moveDown();

        // 제4조 임금
        doc.fontSize(14).text('제4조 【임금】');
        doc.fontSize(11);
        const salaryType = contract.salaryConfig.baseSalaryType === 'HOURLY' ? '시급' :
                           contract.salaryConfig.baseSalaryType === 'DAILY' ? '일급' : '월급';
        doc.text(`급여 형태: ${salaryType}`);
        doc.text(`기본급: ${this.formatCurrency(contract.salaryConfig.baseSalaryAmount)}`);
        doc.text(`급여 지급일: 매월 ${contract.salaryConfig.paymentDate}일`);
        doc.text(`지급 방법: ${contract.salaryConfig.paymentMethod}`);
        doc.moveDown(0.5);

        // 수당
        const allowances = contract.salaryConfig.allowances;
        if (allowances) {
          doc.text('수당:');
          if (allowances.overtimeAllowance) doc.text('  - 연장근로수당: 근로기준법에 따라 지급', { indent: 10 });
          if (allowances.nightAllowance) doc.text('  - 야간근로수당: 근로기준법에 따라 지급', { indent: 10 });
          if (allowances.holidayAllowance) doc.text('  - 휴일근로수당: 근로기준법에 따라 지급', { indent: 10 });
          if (allowances.weeklyHolidayPay) doc.text('  - 주휴수당: 근로기준법에 따라 지급', { indent: 10 });
          if (allowances.mealAllowance) doc.text(`  - 식대: ${this.formatCurrency(allowances.mealAllowance)}`, { indent: 10 });
          if (allowances.transportAllowance) doc.text(`  - 교통비: ${this.formatCurrency(allowances.transportAllowance)}`, { indent: 10 });
        }
        doc.moveDown();

        // 제5조 공제
        doc.fontSize(14).text('제5조 【공제】');
        doc.fontSize(11);
        const deductionConfig = contract.deductionConfig;
        const insurances = [];
        if (deductionConfig.nationalPension) insurances.push('국민연금');
        if (deductionConfig.healthInsurance) insurances.push('건강보험');
        if (deductionConfig.employmentInsurance) insurances.push('고용보험');
        if (deductionConfig.industrialAccident) insurances.push('산재보험');
        doc.text(`4대보험: ${insurances.join(', ') || '없음'}`);
        if (deductionConfig.incomeTax) doc.text('소득세: 근로소득세 및 지방소득세 원천징수');
        doc.moveDown();

        // 제6조 휴가
        doc.fontSize(14).text('제6조 【휴가】');
        doc.fontSize(11);
        doc.text(`연차휴가: ${contract.annualLeaveDays}일`);
        doc.text(`유급휴가: ${contract.paidLeaveDays}일`);
        doc.text(`병가: ${contract.sickLeaveDays}일`);
        doc.moveDown();

        // 제7조 계약해지
        doc.fontSize(14).text('제7조 【계약해지】');
        doc.fontSize(11);
        doc.text(`근로자 사전통보: ${contract.terminationConfig.employeeNotice}일`);
        doc.text(`사용자 사전통보: ${contract.terminationConfig.employerNotice}일`);
        if (contract.terminationConfig.severancePay) {
          doc.text('퇴직금: 근로기준법에 따라 지급');
        }
        doc.moveDown(2);

        // 서명란
        doc.fontSize(12).text(`계약일: ${this.formatDate(new Date())}`, { align: 'center' });
        doc.moveDown(2);

        doc.text('사용자(갑)', 100);
        doc.text('근로자(을)', 350);
        doc.moveDown();

        doc.text(`회사명: ${contract.companyName}`, 100);
        doc.text(`성명: ${contract.staffName}`, 350);
        doc.moveDown();

        doc.text('서명: ____________________', 100);
        doc.text('서명: ____________________', 350);

        // 서명이 있으면 표시
        if (contract.employerSignature) {
          doc.text('(서명완료)', 100);
          doc.text(`서명일: ${contract.employerSignedAt ? this.formatDate(contract.employerSignedAt) : ''}`, 100);
        }
        if (contract.employeeSignature) {
          doc.text('(서명완료)', 350);
          doc.text(`서명일: ${contract.employeeSignedAt ? this.formatDate(contract.employeeSignedAt) : ''}`, 350);
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 손익계산서 PDF 생성
   */
  static async generateProfitLoss(statement: ProfitLossStatement): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = this.createDocument();
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // 제목
        doc.fontSize(20).text('손 익 계 산 서', { align: 'center' });
        doc.moveDown();
        doc.fontSize(14).text(`(${statement.companyName})`, { align: 'center' });
        doc.moveDown(2);

        // 기간
        doc.fontSize(11);
        doc.text(`기간: ${this.formatDate(statement.period.startDate)} ~ ${this.formatDate(statement.period.endDate)}`);
        doc.text(`생성일: ${this.formatDate(statement.generatedAt)}`);
        doc.moveDown(1.5);

        // 표 헤더
        const colWidth = 150;
        const col1 = 50;
        const col2 = 280;
        const col3 = 400;

        doc.fontSize(12);
        doc.text('항목', col1, doc.y, { width: colWidth });
        doc.text('내역', col2, doc.y - 14, { width: colWidth });
        doc.text('금액', col3, doc.y - 14, { width: colWidth, align: 'right' });
        doc.moveDown();
        doc.moveTo(col1, doc.y).lineTo(500, doc.y).stroke();
        doc.moveDown(0.5);

        // 매출
        doc.fontSize(13).text('Ⅰ. 매출액', col1);
        doc.moveDown(0.5);
        doc.fontSize(11);
        doc.text('매출', col2, doc.y);
        doc.text(this.formatCurrency(statement.revenue.sales), col3, doc.y - 14, { width: colWidth, align: 'right' });
        doc.moveDown(0.3);
        doc.text('기타수입', col2, doc.y);
        doc.text(this.formatCurrency(statement.revenue.otherIncome), col3, doc.y - 14, { width: colWidth, align: 'right' });
        doc.moveDown(0.5);
        doc.fontSize(12).text('총 매출액', col2);
        doc.text(this.formatCurrency(statement.revenue.total), col3, doc.y - 14, { width: colWidth, align: 'right' });
        doc.moveDown();

        // 비용
        doc.fontSize(13).text('Ⅱ. 비용', col1);
        doc.moveDown(0.5);
        doc.fontSize(11);

        const expenses = [
          ['매출원가', statement.expenses.costOfGoodsSold],
          ['인건비', statement.expenses.laborCost],
          ['임차료', statement.expenses.rent],
          ['공과금', statement.expenses.utilities],
          ['마케팅비', statement.expenses.marketing],
          ['감가상각비', statement.expenses.depreciation],
          ['기타비용', statement.expenses.other],
        ];

        expenses.forEach(([label, amount]) => {
          doc.text(label as string, col2, doc.y);
          doc.text(this.formatCurrency(amount as number), col3, doc.y - 14, { width: colWidth, align: 'right' });
          doc.moveDown(0.3);
        });

        doc.moveDown(0.3);
        doc.fontSize(12).text('총 비용', col2);
        doc.text(this.formatCurrency(statement.expenses.total), col3, doc.y - 14, { width: colWidth, align: 'right' });
        doc.moveDown();

        // 이익
        doc.moveTo(col1, doc.y).lineTo(500, doc.y).stroke();
        doc.moveDown(0.5);

        doc.fontSize(13).text('Ⅲ. 이익', col1);
        doc.moveDown(0.5);
        doc.fontSize(11);

        doc.text('매출총이익', col2, doc.y);
        doc.text(this.formatCurrency(statement.grossProfit), col3, doc.y - 14, { width: colWidth, align: 'right' });
        doc.moveDown(0.3);

        doc.text('영업이익', col2, doc.y);
        doc.text(this.formatCurrency(statement.operatingProfit), col3, doc.y - 14, { width: colWidth, align: 'right' });
        doc.moveDown(0.5);

        doc.moveTo(col1, doc.y).lineTo(500, doc.y).stroke();
        doc.moveDown(0.5);

        doc.fontSize(14).text('순이익', col2);
        doc.text(this.formatCurrency(statement.netProfit), col3, doc.y - 14, { width: colWidth, align: 'right' });
        doc.moveDown(0.3);

        doc.fontSize(11).text(`이익률: ${(statement.profitMargin * 100).toFixed(1)}%`, col2);
        doc.moveDown(2);

        // 비용 구성 breakdown
        if (statement.breakdown && statement.breakdown.length > 0) {
          doc.fontSize(13).text('비용 구성 상세', col1);
          doc.moveDown(0.5);
          doc.fontSize(10);

          statement.breakdown.forEach(item => {
            doc.text(`${item.category}: ${this.formatCurrency(item.amount)} (${item.percentage.toFixed(1)}%)`);
            doc.moveDown(0.2);
          });
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 출퇴근 보고서 PDF 생성
   */
  static async generateAttendanceReport(data: {
    companyName: string;
    period: { startDate: Date; endDate: Date };
    staffName: string;
    records: Array<{
      date: Date;
      scheduledIn?: Date;
      scheduledOut?: Date;
      actualIn?: Date;
      actualOut?: Date;
      workHours: number;
      overtimeHours: number;
      status: string;
    }>;
    summary: {
      totalDays: number;
      workedDays: number;
      lateDays: number;
      absentDays: number;
      totalHours: number;
      overtimeHours: number;
    };
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = this.createDocument();
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // 제목
        doc.fontSize(18).text('출퇴근 현황 보고서', { align: 'center' });
        doc.moveDown(2);

        // 기본 정보
        doc.fontSize(11);
        doc.text(`회사: ${data.companyName}`);
        doc.text(`대상자: ${data.staffName}`);
        doc.text(`기간: ${this.formatDate(data.period.startDate)} ~ ${this.formatDate(data.period.endDate)}`);
        doc.moveDown(1.5);

        // 요약
        doc.fontSize(14).text('요약');
        doc.moveDown(0.5);
        doc.fontSize(11);
        doc.text(`총 근무일: ${data.summary.totalDays}일`);
        doc.text(`출근일: ${data.summary.workedDays}일`);
        doc.text(`지각: ${data.summary.lateDays}일`);
        doc.text(`결근: ${data.summary.absentDays}일`);
        doc.text(`총 근무시간: ${data.summary.totalHours}시간`);
        doc.text(`초과근무시간: ${data.summary.overtimeHours}시간`);
        doc.moveDown(1.5);

        // 상세 기록
        doc.fontSize(14).text('상세 기록');
        doc.moveDown(0.5);

        // 테이블 헤더
        doc.fontSize(9);
        const cols = [50, 130, 190, 250, 310, 370, 430];
        doc.text('날짜', cols[0]);
        doc.text('예정출근', cols[1], doc.y - 12);
        doc.text('예정퇴근', cols[2], doc.y - 12);
        doc.text('실제출근', cols[3], doc.y - 12);
        doc.text('실제퇴근', cols[4], doc.y - 12);
        doc.text('근무시간', cols[5], doc.y - 12);
        doc.text('상태', cols[6], doc.y - 12);
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(500, doc.y).stroke();
        doc.moveDown(0.3);

        // 기록들
        const formatTime = (date?: Date) => {
          if (!date) return '-';
          const d = new Date(date);
          return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        };

        data.records.forEach(record => {
          const y = doc.y;
          doc.text(this.formatDate(record.date).replace('년', '.').replace('월', '.').replace('일', ''), cols[0], y);
          doc.text(formatTime(record.scheduledIn), cols[1], y);
          doc.text(formatTime(record.scheduledOut), cols[2], y);
          doc.text(formatTime(record.actualIn), cols[3], y);
          doc.text(formatTime(record.actualOut), cols[4], y);
          doc.text(`${record.workHours}h`, cols[5], y);
          doc.text(record.status, cols[6], y);
          doc.moveDown(0.4);
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

export default PDFGenerator;
