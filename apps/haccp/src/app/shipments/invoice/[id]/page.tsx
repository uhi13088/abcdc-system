'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Printer, Download, ArrowLeft, X } from 'lucide-react';

interface ShipmentItem {
  product_id: string;
  product_name?: string;
  product_code?: string;
  lot_number: string;
  quantity: number;
  unit: string;
  unit_price?: number;
  amount?: number;
}

interface ShipmentRecord {
  id: string;
  shipment_date: string;
  shipment_number: string;
  customer_name: string;
  customer_address: string;
  customer_contact?: string;
  customer_business_number?: string;
  customer_representative?: string;
  items: ShipmentItem[];
  vehicle_number: string;
  driver_name: string;
  notes?: string;
  total_amount?: number;
  vat_amount?: number;
  grand_total?: number;
  shipped_by_name?: string;
}

interface Company {
  name: string;
  business_number?: string;
  representative?: string;
  address?: string;
  phone?: string;
  fax?: string;
  email?: string;
}

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [shipment, setShipment] = useState<ShipmentRecord | null>(null);
  const [company, setCompany] = useState<Company>({ name: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 출하 정보 조회
        const shipmentRes = await fetch(`/api/haccp/shipments/${params.id}`);
        if (shipmentRes.ok) {
          const data = await shipmentRes.json();
          // 금액 계산 (샘플)
          const itemsWithAmount = (data.items || []).map((item: ShipmentItem) => ({
            ...item,
            unit_price: item.unit_price || 10000,
            amount: (item.unit_price || 10000) * item.quantity,
          }));
          const totalAmount = itemsWithAmount.reduce((sum: number, item: ShipmentItem) => sum + (item.amount || 0), 0);
          const vatAmount = Math.round(totalAmount * 0.1);
          setShipment({
            ...data,
            items: itemsWithAmount,
            total_amount: totalAmount,
            vat_amount: vatAmount,
            grand_total: totalAmount + vatAmount,
          });
        }

        // 회사 정보 조회
        const companyRes = await fetch('/api/haccp/company');
        if (companyRes.ok) {
          const companyData = await companyRes.json();
          setCompany(companyData);
        } else {
          // 기본값
          setCompany({
            name: '우리베이커리',
            business_number: '123-45-67890',
            representative: '홍길동',
            address: '서울시 강남구 테헤란로 123',
            phone: '02-1234-5678',
            fax: '02-1234-5679',
          });
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id]);

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('ko-KR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-gray-500 mb-4">출하 정보를 찾을 수 없습니다</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 text-blue-600 hover:underline"
        >
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <>
      {/* 인쇄 버튼 (인쇄시 숨김) */}
      <div className="print:hidden fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={() => router.back()}
          className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
          title="돌아가기"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          인쇄 / PDF 저장
        </button>
      </div>

      {/* 거래명세서 */}
      <div ref={printRef} className="max-w-[210mm] mx-auto p-8 bg-white print:p-0 print:m-0">
        <style jsx global>{`
          @media print {
            @page {
              size: A4;
              margin: 10mm;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}</style>

        {/* 제목 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-widest">거 래 명 세 서</h1>
          <p className="text-sm text-gray-500 mt-2">(공급받는자 보관용)</p>
        </div>

        {/* 상단 정보 */}
        <div className="flex justify-between mb-6 text-sm">
          <div className="flex-1">
            <p className="text-lg font-bold mb-2">{shipment.customer_name} 귀하</p>
            <p className="text-gray-600">{shipment.customer_address}</p>
            {shipment.customer_contact && (
              <p className="text-gray-600">TEL: {shipment.customer_contact}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-gray-600">명세서번호: <span className="font-mono">{shipment.shipment_number}</span></p>
            <p className="text-gray-600">거래일자: {formatDate(shipment.shipment_date)}</p>
          </div>
        </div>

        {/* 공급자 정보 */}
        <div className="border border-gray-800 mb-6">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-800">
                <td className="bg-gray-100 px-3 py-2 font-medium w-24 text-center border-r border-gray-800">공급자</td>
                <td className="px-3 py-2" colSpan={3}>
                  <div className="flex justify-between">
                    <span>상호: <strong>{company.name}</strong></span>
                    <span>대표자: {company.representative}</span>
                  </div>
                </td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="bg-gray-100 px-3 py-2 font-medium text-center border-r border-gray-800">사업자번호</td>
                <td className="px-3 py-2 border-r border-gray-800">{company.business_number}</td>
                <td className="bg-gray-100 px-3 py-2 font-medium text-center border-r border-gray-800 w-24">전화</td>
                <td className="px-3 py-2">{company.phone}</td>
              </tr>
              <tr>
                <td className="bg-gray-100 px-3 py-2 font-medium text-center border-r border-gray-800">주소</td>
                <td className="px-3 py-2" colSpan={3}>{company.address}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 품목 테이블 */}
        <table className="w-full border border-gray-800 text-sm mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-800 px-2 py-2 text-center w-12">NO</th>
              <th className="border border-gray-800 px-2 py-2 text-center">품목명</th>
              <th className="border border-gray-800 px-2 py-2 text-center w-24">규격</th>
              <th className="border border-gray-800 px-2 py-2 text-center w-16">수량</th>
              <th className="border border-gray-800 px-2 py-2 text-center w-16">단위</th>
              <th className="border border-gray-800 px-2 py-2 text-center w-24">단가</th>
              <th className="border border-gray-800 px-2 py-2 text-center w-28">금액</th>
              <th className="border border-gray-800 px-2 py-2 text-center w-24">비고</th>
            </tr>
          </thead>
          <tbody>
            {shipment.items.map((item, idx) => (
              <tr key={idx}>
                <td className="border border-gray-800 px-2 py-2 text-center">{idx + 1}</td>
                <td className="border border-gray-800 px-2 py-2">{item.product_name || '-'}</td>
                <td className="border border-gray-800 px-2 py-2 text-center font-mono text-xs">{item.lot_number}</td>
                <td className="border border-gray-800 px-2 py-2 text-right">{formatNumber(item.quantity)}</td>
                <td className="border border-gray-800 px-2 py-2 text-center">{item.unit}</td>
                <td className="border border-gray-800 px-2 py-2 text-right">{formatNumber(item.unit_price || 0)}</td>
                <td className="border border-gray-800 px-2 py-2 text-right">{formatNumber(item.amount || 0)}</td>
                <td className="border border-gray-800 px-2 py-2 text-center"></td>
              </tr>
            ))}
            {/* 빈 행 추가 (최소 10행) */}
            {Array.from({ length: Math.max(0, 10 - shipment.items.length) }).map((_, idx) => (
              <tr key={`empty-${idx}`}>
                <td className="border border-gray-800 px-2 py-2 text-center">&nbsp;</td>
                <td className="border border-gray-800 px-2 py-2"></td>
                <td className="border border-gray-800 px-2 py-2"></td>
                <td className="border border-gray-800 px-2 py-2"></td>
                <td className="border border-gray-800 px-2 py-2"></td>
                <td className="border border-gray-800 px-2 py-2"></td>
                <td className="border border-gray-800 px-2 py-2"></td>
                <td className="border border-gray-800 px-2 py-2"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 합계 */}
        <div className="flex justify-end mb-6">
          <table className="border border-gray-800 text-sm">
            <tbody>
              <tr>
                <td className="bg-gray-100 border border-gray-800 px-4 py-2 font-medium">공급가액</td>
                <td className="border border-gray-800 px-4 py-2 text-right w-32">
                  ￦ {formatNumber(shipment.total_amount || 0)}
                </td>
              </tr>
              <tr>
                <td className="bg-gray-100 border border-gray-800 px-4 py-2 font-medium">부가세</td>
                <td className="border border-gray-800 px-4 py-2 text-right">
                  ￦ {formatNumber(shipment.vat_amount || 0)}
                </td>
              </tr>
              <tr>
                <td className="bg-gray-100 border border-gray-800 px-4 py-2 font-bold">합계금액</td>
                <td className="border border-gray-800 px-4 py-2 text-right font-bold text-lg">
                  ￦ {formatNumber(shipment.grand_total || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 배송 정보 */}
        <div className="border border-gray-800 mb-6">
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="bg-gray-100 border-r border-b border-gray-800 px-3 py-2 font-medium text-center w-24">차량번호</td>
                <td className="border-r border-b border-gray-800 px-3 py-2">{shipment.vehicle_number || '-'}</td>
                <td className="bg-gray-100 border-r border-b border-gray-800 px-3 py-2 font-medium text-center w-24">배송기사</td>
                <td className="border-b border-gray-800 px-3 py-2">{shipment.driver_name || '-'}</td>
              </tr>
              <tr>
                <td className="bg-gray-100 border-r border-gray-800 px-3 py-2 font-medium text-center">비고</td>
                <td className="px-3 py-2" colSpan={3}>{shipment.notes || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 서명란 */}
        <div className="flex justify-between items-end mt-12">
          <div className="text-sm text-gray-500">
            <p>위와 같이 거래합니다.</p>
            <p className="mt-1">{formatDate(shipment.shipment_date)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm mb-2">공급자</p>
            <div className="border border-gray-400 w-32 h-16 flex items-center justify-center">
              <span className="text-xs text-gray-400">(인)</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm mb-2">인수자</p>
            <div className="border border-gray-400 w-32 h-16 flex items-center justify-center">
              <span className="text-xs text-gray-400">(인)</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
