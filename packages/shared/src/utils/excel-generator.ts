/**
 * 엑셀 생성 유틸리티
 * 급여대장, 출퇴근 보고서 등 엑셀 파일 생성
 */

import ExcelJS from 'exceljs';
import { Salary, Attendance } from '../types/entities';

export interface PayrollReportData {
  staffId: string;
  staffName: string;
  storeName?: string;
  residentNumber?: string; // 주민번호 (없으면 생년월일)
  address?: string;
  department?: string;
  position?: string;
  baseSalary: number;
  overtimePay: number;
  nightPay: number;
  holidayPay: number;
  weeklyHolidayPay: number;
  mealAllowance: number;
  transportAllowance: number;
  positionAllowance: number;
  otherAllowances: number;
  totalGrossPay: number;
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
  incomeTax: number;
  localIncomeTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  workDays: number;
  totalHours: number;
}

export interface AttendanceReportData {
  staffId: string;
  staffName: string;
  department?: string;
  records: Array<{
    date: string;
    scheduledIn: string;
    scheduledOut: string;
    actualIn: string;
    actualOut: string;
    workHours: number;
    overtimeHours: number;
    nightHours: number;
    status: string;
    notes?: string;
  }>;
  summary: {
    totalDays: number;
    workedDays: number;
    lateDays: number;
    earlyDays: number;
    absentDays: number;
    halfDays: number;
    totalHours: number;
    overtimeHours: number;
    nightHours: number;
  };
}

export interface HaccpReportData {
  storeName: string;
  period: { startDate: Date; endDate: Date };
  temperatureRecords: Array<{
    date: string;
    location: string;
    temperature: number;
    isWithinLimit: boolean;
    recordedBy: string;
  }>;
  checklistRecords: Array<{
    date: string;
    checkType: string;
    status: string;
    completedBy: string;
    notes?: string;
  }>;
  deviations: Array<{
    date: string;
    type: string;
    description: string;
    correctiveAction: string;
    status: string;
  }>;
}

export class ExcelGenerator {
  private static applyHeaderStyle(cell: ExcelJS.Cell): void {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    cell.font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  }

  private static applyDataCellStyle(cell: ExcelJS.Cell, isNumber = false): void {
    cell.alignment = {
      horizontal: isNumber ? 'right' : 'center',
      vertical: 'middle',
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  }

  private static formatCurrency(value: number): string {
    return new Intl.NumberFormat('ko-KR').format(value);
  }

  /**
   * 급여대장 엑셀 생성
   */
  static async generatePayrollReport(
    data: PayrollReportData[],
    options: {
      companyName: string;
      year: number;
      month: number;
    }
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ABC Staff System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('급여대장', {
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
      },
    });

    // 제목
    sheet.mergeCells('A1:J1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `${options.companyName} ${options.year}년 ${options.month}월 급여대장`;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    // 생성일
    sheet.mergeCells('A2:J2');
    const dateCell = sheet.getCell('A2');
    dateCell.value = `생성일: ${new Date().toLocaleDateString('ko-KR')}`;
    dateCell.alignment = { horizontal: 'right' };

    // 헤더 - 간소화된 버전
    const headers = [
      { key: 'storeName', header: '매장명', width: 15 },
      { key: 'name', header: '직원명', width: 12 },
      { key: 'residentNumber', header: '주민번호/생년월일', width: 18 },
      { key: 'address', header: '주소', width: 30 },
      { key: 'baseSalary', header: '기본급', width: 14 },
      { key: 'overtimePay', header: '연장수당', width: 14 },
      { key: 'nightPay', header: '야간수당', width: 14 },
      { key: 'totalGross', header: '총지급액', width: 14 },
      { key: 'totalDeductions', header: '공제액', width: 14 },
      { key: 'netPay', header: '실지급액', width: 14 },
    ];

    // 컬럼 설정
    sheet.columns = headers.map(h => ({ key: h.key, width: h.width }));

    // 헤더 행
    const headerRow = sheet.getRow(4);
    headers.forEach((h, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = h.header;
      this.applyHeaderStyle(cell);
    });
    headerRow.height = 25;

    // 데이터 행
    let totalGrossSum = 0;
    let totalDeductionsSum = 0;
    let totalNetPaySum = 0;

    data.forEach((row, idx) => {
      const dataRow = sheet.getRow(5 + idx);

      const rowData = [
        row.storeName || '-',
        row.staffName,
        row.residentNumber || '-',
        row.address || '-',
        this.formatCurrency(row.baseSalary),
        this.formatCurrency(row.overtimePay),
        this.formatCurrency(row.nightPay),
        this.formatCurrency(row.totalGrossPay),
        this.formatCurrency(row.totalDeductions),
        this.formatCurrency(row.netPay),
      ];

      rowData.forEach((value, colIdx) => {
        const cell = dataRow.getCell(colIdx + 1);
        cell.value = value;
        this.applyDataCellStyle(cell, colIdx >= 4);
      });

      totalGrossSum += row.totalGrossPay;
      totalDeductionsSum += row.totalDeductions;
      totalNetPaySum += row.netPay;
    });

    // 합계 행
    const sumRow = sheet.getRow(5 + data.length);
    sumRow.getCell(1).value = '합계';
    sumRow.getCell(1).font = { bold: true };
    sheet.mergeCells(5 + data.length, 1, 5 + data.length, 4);

    sumRow.getCell(8).value = this.formatCurrency(totalGrossSum);
    sumRow.getCell(9).value = this.formatCurrency(totalDeductionsSum);
    sumRow.getCell(10).value = this.formatCurrency(totalNetPaySum);

    [8, 9, 10].forEach(col => {
      const cell = sumRow.getCell(col);
      cell.font = { bold: true };
      this.applyDataCellStyle(cell, true);
    });

    // 버퍼로 반환
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * 출퇴근 보고서 엑셀 생성
   */
  static async generateAttendanceReport(
    data: AttendanceReportData[],
    options: {
      companyName: string;
      period: { startDate: Date; endDate: Date };
    }
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ABC Staff System';
    workbook.created = new Date();

    // 요약 시트
    const summarySheet = workbook.addWorksheet('요약', {
      pageSetup: { paperSize: 9, orientation: 'portrait' },
    });

    // 요약 제목
    summarySheet.mergeCells('A1:J1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = `${options.companyName} 출퇴근 현황`;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };

    // 기간
    summarySheet.mergeCells('A2:J2');
    const periodCell = summarySheet.getCell('A2');
    periodCell.value = `기간: ${options.period.startDate.toLocaleDateString('ko-KR')} ~ ${options.period.endDate.toLocaleDateString('ko-KR')}`;
    periodCell.alignment = { horizontal: 'center' };

    // 요약 헤더
    const summaryHeaders = [
      'No', '성명', '부서', '총일수', '출근일', '지각', '조퇴', '결근', '반차',
      '총시간', '초과시간', '야간시간',
    ];

    const summaryHeaderRow = summarySheet.getRow(4);
    summaryHeaders.forEach((h, idx) => {
      const cell = summaryHeaderRow.getCell(idx + 1);
      cell.value = h;
      this.applyHeaderStyle(cell);
    });

    // 요약 데이터
    data.forEach((staff, idx) => {
      const row = summarySheet.getRow(5 + idx);
      const rowData = [
        idx + 1,
        staff.staffName,
        staff.department || '-',
        staff.summary.totalDays,
        staff.summary.workedDays,
        staff.summary.lateDays,
        staff.summary.earlyDays,
        staff.summary.absentDays,
        staff.summary.halfDays,
        staff.summary.totalHours,
        staff.summary.overtimeHours,
        staff.summary.nightHours,
      ];

      rowData.forEach((value, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = value;
        this.applyDataCellStyle(cell, colIdx >= 3);
      });
    });

    summarySheet.columns = [
      { width: 5 }, { width: 12 }, { width: 12 }, { width: 8 }, { width: 8 },
      { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 10 },
      { width: 10 }, { width: 10 },
    ];

    // 개인별 상세 시트
    data.forEach(staff => {
      const sheet = workbook.addWorksheet(staff.staffName, {
        pageSetup: { paperSize: 9, orientation: 'landscape' },
      });

      // 제목
      sheet.mergeCells('A1:I1');
      sheet.getCell('A1').value = `${staff.staffName} 출퇴근 상세`;
      sheet.getCell('A1').font = { bold: true, size: 14 };

      // 헤더
      const detailHeaders = [
        '날짜', '예정출근', '예정퇴근', '실제출근', '실제퇴근',
        '근무시간', '초과시간', '상태', '비고',
      ];

      const headerRow = sheet.getRow(3);
      detailHeaders.forEach((h, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = h;
        this.applyHeaderStyle(cell);
      });

      // 데이터
      staff.records.forEach((record, idx) => {
        const row = sheet.getRow(4 + idx);
        const rowData = [
          record.date,
          record.scheduledIn,
          record.scheduledOut,
          record.actualIn,
          record.actualOut,
          record.workHours,
          record.overtimeHours,
          record.status,
          record.notes || '',
        ];

        rowData.forEach((value, colIdx) => {
          const cell = row.getCell(colIdx + 1);
          cell.value = value;
          this.applyDataCellStyle(cell);

          // 상태별 색상
          if (colIdx === 7) {
            if (value === '지각') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
            } else if (value === '결근') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
              cell.font = { color: { argb: 'FFFFFFFF' } };
            }
          }
        });
      });

      sheet.columns = [
        { width: 12 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
        { width: 10 }, { width: 10 }, { width: 10 }, { width: 20 },
      ];
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * HACCP 보고서 엑셀 생성
   */
  static async generateHaccpReport(
    data: HaccpReportData,
    options?: { includeCharts?: boolean }
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ABC Staff System';
    workbook.created = new Date();

    // 온도 기록 시트
    const tempSheet = workbook.addWorksheet('온도기록', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    tempSheet.mergeCells('A1:F1');
    tempSheet.getCell('A1').value = `${data.storeName} HACCP 온도 기록`;
    tempSheet.getCell('A1').font = { bold: true, size: 14 };

    tempSheet.mergeCells('A2:F2');
    tempSheet.getCell('A2').value = `기간: ${data.period.startDate.toLocaleDateString('ko-KR')} ~ ${data.period.endDate.toLocaleDateString('ko-KR')}`;

    const tempHeaders = ['날짜', '위치', '온도(℃)', '적정여부', '기록자', '비고'];
    const tempHeaderRow = tempSheet.getRow(4);
    tempHeaders.forEach((h, idx) => {
      const cell = tempHeaderRow.getCell(idx + 1);
      cell.value = h;
      this.applyHeaderStyle(cell);
    });

    data.temperatureRecords.forEach((record, idx) => {
      const row = tempSheet.getRow(5 + idx);
      const rowData = [
        record.date,
        record.location,
        record.temperature,
        record.isWithinLimit ? '적정' : '부적정',
        record.recordedBy,
        '',
      ];

      rowData.forEach((value, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = value;
        this.applyDataCellStyle(cell);

        if (colIdx === 3 && !record.isWithinLimit) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
          cell.font = { color: { argb: 'FFFFFFFF' } };
        }
      });
    });

    tempSheet.columns = [
      { width: 12 }, { width: 15 }, { width: 12 }, { width: 10 }, { width: 12 }, { width: 20 },
    ];

    // 점검표 기록 시트
    const checkSheet = workbook.addWorksheet('점검기록', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    checkSheet.mergeCells('A1:E1');
    checkSheet.getCell('A1').value = `${data.storeName} HACCP 점검 기록`;
    checkSheet.getCell('A1').font = { bold: true, size: 14 };

    const checkHeaders = ['날짜', '점검유형', '상태', '점검자', '비고'];
    const checkHeaderRow = checkSheet.getRow(3);
    checkHeaders.forEach((h, idx) => {
      const cell = checkHeaderRow.getCell(idx + 1);
      cell.value = h;
      this.applyHeaderStyle(cell);
    });

    data.checklistRecords.forEach((record, idx) => {
      const row = checkSheet.getRow(4 + idx);
      const rowData = [
        record.date,
        record.checkType,
        record.status,
        record.completedBy,
        record.notes || '',
      ];

      rowData.forEach((value, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = value;
        this.applyDataCellStyle(cell);
      });
    });

    checkSheet.columns = [
      { width: 12 }, { width: 15 }, { width: 12 }, { width: 12 }, { width: 30 },
    ];

    // 일탈 기록 시트
    const devSheet = workbook.addWorksheet('일탈기록', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    devSheet.mergeCells('A1:E1');
    devSheet.getCell('A1').value = `${data.storeName} HACCP 일탈 기록`;
    devSheet.getCell('A1').font = { bold: true, size: 14 };

    const devHeaders = ['날짜', '유형', '내용', '시정조치', '상태'];
    const devHeaderRow = devSheet.getRow(3);
    devHeaders.forEach((h, idx) => {
      const cell = devHeaderRow.getCell(idx + 1);
      cell.value = h;
      this.applyHeaderStyle(cell);
    });

    data.deviations.forEach((record, idx) => {
      const row = devSheet.getRow(4 + idx);
      const rowData = [
        record.date,
        record.type,
        record.description,
        record.correctiveAction,
        record.status,
      ];

      rowData.forEach((value, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = value;
        this.applyDataCellStyle(cell);
      });
    });

    devSheet.columns = [
      { width: 12 }, { width: 12 }, { width: 30 }, { width: 30 }, { width: 12 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * 손익 보고서 엑셀 생성
   */
  static async generateProfitLossReport(data: {
    companyName: string;
    period: { startDate: Date; endDate: Date };
    monthly: Array<{
      month: string;
      revenue: number;
      expenses: number;
      laborCost: number;
      rent: number;
      utilities: number;
      other: number;
      netProfit: number;
      profitMargin: number;
    }>;
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ABC Staff System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('손익현황', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    // 제목
    sheet.mergeCells('A1:I1');
    sheet.getCell('A1').value = `${data.companyName} 손익 현황`;
    sheet.getCell('A1').font = { bold: true, size: 16 };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:I2');
    sheet.getCell('A2').value = `기간: ${data.period.startDate.toLocaleDateString('ko-KR')} ~ ${data.period.endDate.toLocaleDateString('ko-KR')}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    // 헤더
    const headers = [
      '월', '매출', '총비용', '인건비', '임차료', '공과금', '기타', '순이익', '이익률',
    ];

    const headerRow = sheet.getRow(4);
    headers.forEach((h, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = h;
      this.applyHeaderStyle(cell);
    });

    // 데이터
    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalNetProfit = 0;

    data.monthly.forEach((row, idx) => {
      const dataRow = sheet.getRow(5 + idx);
      const rowData = [
        row.month,
        this.formatCurrency(row.revenue),
        this.formatCurrency(row.expenses),
        this.formatCurrency(row.laborCost),
        this.formatCurrency(row.rent),
        this.formatCurrency(row.utilities),
        this.formatCurrency(row.other),
        this.formatCurrency(row.netProfit),
        `${(row.profitMargin * 100).toFixed(1)}%`,
      ];

      rowData.forEach((value, colIdx) => {
        const cell = dataRow.getCell(colIdx + 1);
        cell.value = value;
        this.applyDataCellStyle(cell, colIdx >= 1 && colIdx <= 7);

        // 손실인 경우 빨간색
        if (colIdx === 7 && row.netProfit < 0) {
          cell.font = { color: { argb: 'FFFF0000' } };
        }
      });

      totalRevenue += row.revenue;
      totalExpenses += row.expenses;
      totalNetProfit += row.netProfit;
    });

    // 합계 행
    const sumRow = sheet.getRow(5 + data.monthly.length);
    sumRow.getCell(1).value = '합계';
    sumRow.getCell(1).font = { bold: true };
    sumRow.getCell(2).value = this.formatCurrency(totalRevenue);
    sumRow.getCell(3).value = this.formatCurrency(totalExpenses);
    sumRow.getCell(8).value = this.formatCurrency(totalNetProfit);
    sumRow.getCell(9).value = `${((totalNetProfit / totalRevenue) * 100).toFixed(1)}%`;

    [1, 2, 3, 8, 9].forEach(col => {
      const cell = sumRow.getCell(col);
      cell.font = { bold: true };
      this.applyDataCellStyle(cell, col >= 2);
    });

    sheet.columns = [
      { width: 10 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 12 },
      { width: 12 }, { width: 12 }, { width: 14 }, { width: 10 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

export default ExcelGenerator;
