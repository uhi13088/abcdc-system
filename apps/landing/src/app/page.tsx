import Link from 'next/link';
import {
  Users,
  Clock,
  ShieldCheck,
  BarChart3,
  Calendar,
  CheckCircle,
  ArrowRight,
  Star,
  Building2,
  Smartphone,
  Factory,
  Coffee,
} from 'lucide-react';

export default function LandingPage() {
  const features = [
    {
      icon: Users,
      title: '직원 관리',
      description: '직원 정보, 계약서, 근무 이력을 한곳에서 통합 관리하세요.',
    },
    {
      icon: Clock,
      title: '출퇴근 관리',
      description: '모바일 앱으로 실시간 출퇴근 체크와 근무시간을 자동 계산합니다.',
    },
    {
      icon: Calendar,
      title: '스케줄 관리',
      description: '직관적인 캘린더로 근무 스케줄을 효율적으로 관리하세요.',
    },
    {
      icon: ShieldCheck,
      title: 'HACCP 관리',
      description: 'HACCP 기준에 맞춘 위생 점검과 기록을 디지털로 관리합니다.',
    },
    {
      icon: BarChart3,
      title: '경영 분석',
      description: '매출, 비용, 손익을 실시간으로 분석하고 리포트를 받아보세요.',
    },
    {
      icon: Smartphone,
      title: '모바일 앱',
      description: '직원들은 모바일 앱으로 어디서든 편리하게 사용할 수 있습니다.',
    },
  ];

  const plans = [
    {
      name: 'Free',
      price: '0',
      description: '소규모 매장에 적합',
      features: ['1개 매장', '5명 직원', '기본 출퇴근 관리', '이메일 지원'],
      cta: '무료 시작',
      highlighted: false,
    },
    {
      name: 'Basic',
      price: '49,000',
      description: '성장하는 비즈니스에 적합',
      features: ['3개 매장', '20명 직원', '스케줄 관리', 'HACCP 기본', '채팅 지원'],
      cta: '시작하기',
      highlighted: false,
    },
    {
      name: 'Premium',
      price: '99,000',
      description: '다점포 운영에 최적',
      features: ['10개 매장', '50명 직원', '경영 분석', 'HACCP 전체', '우선 지원'],
      cta: '시작하기',
      highlighted: true,
    },
    {
      name: 'Enterprise',
      price: '문의',
      description: '대규모 프랜차이즈',
      features: ['무제한 매장', '무제한 직원', '커스텀 기능', '전담 매니저', 'SLA 보장'],
      cta: '문의하기',
      highlighted: false,
    },
  ];

  const addons = [
    {
      name: 'HACCP 애드온',
      icon: Factory,
      price: '99,000',
      description: '식품 제조 공장을 위한 HACCP 관리',
      features: [
        'HACCP 전용 모바일 앱',
        'CCP 모니터링 (9개 모듈)',
        '온도 센서 IoT 연동',
        'HACCP 심사 준비 리포트',
        '개선조치 워크플로우',
      ],
      color: 'green',
    },
    {
      name: '로스팅 애드온',
      icon: Coffee,
      price: '99,000',
      description: '커피 로스터리를 위한 로스팅 관리',
      features: [
        '로스팅 전용 웹 대시보드',
        '생두 재고 관리',
        '로스팅 배치 기록',
        '프로파일 관리',
        '커핑 세션 기록',
      ],
      color: 'amber',
    },
  ];

  const testimonials = [
    {
      quote: 'ABC Staff를 도입하고 나서 인력 관리에 드는 시간이 50% 줄었습니다. 정말 강력 추천합니다!',
      author: '김사장',
      company: '맛있는 치킨 (12개 매장)',
      rating: 5,
    },
    {
      quote: 'HACCP 관리가 완전히 디지털화되어 위생 점검이 훨씬 체계적으로 바뀌었습니다.',
      author: '이대표',
      company: '카페모카 프랜차이즈 (35개 매장)',
      rating: 5,
    },
    {
      quote: '직원들이 모바일 앱으로 쉽게 출퇴근 체크하고, 스케줄도 확인해서 너무 편해졌어요.',
      author: '박매니저',
      company: '행복한 베이커리 (5개 매장)',
      rating: 5,
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-sm z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-primary">ABC Staff</span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900">기능</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900">요금</a>
              <a href="#testimonials" className="text-gray-600 hover:text-gray-900">고객 후기</a>
            </nav>
            <div className="flex items-center space-x-4">
              <Link href="/auth/login" className="text-gray-600 hover:text-gray-900">
                로그인
              </Link>
              <Link
                href="/auth/register"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                무료 시작
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-primary-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              스마트한
              <span className="text-primary"> 인력 관리</span>
              <br />솔루션
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              직원 관리, 출퇴근, 스케줄, HACCP, 경영관리까지
              <br />
              식품 프랜차이즈에 필요한 모든 것을 하나의 플랫폼에서
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/auth/register"
                className="px-8 py-4 bg-primary text-white text-lg font-medium rounded-lg hover:bg-primary-700 transition-colors flex items-center"
              >
                무료로 시작하기
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <a
                href="#features"
                className="px-8 py-4 text-gray-700 text-lg font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                기능 살펴보기
              </a>
            </div>
            <div className="mt-12 flex items-center justify-center space-x-8 text-sm text-gray-500">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                신용카드 불필요
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                14일 무료 체험
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                언제든 취소 가능
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-4xl font-bold text-primary">500+</p>
              <p className="text-gray-600 mt-1">등록된 회사</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-primary">10,000+</p>
              <p className="text-gray-600 mt-1">활성 사용자</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-primary">2,000+</p>
              <p className="text-gray-600 mt-1">연결된 매장</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-primary">99.9%</p>
              <p className="text-gray-600 mt-1">서비스 가동률</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              모든 것을 하나의 플랫폼에서
            </h2>
            <p className="text-xl text-gray-600">
              직원 관리부터 경영 분석까지, ABC Staff가 제공하는 기능을 확인하세요
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-xl p-8 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              비즈니스에 맞는 요금제 선택
            </h2>
            <p className="text-xl text-gray-600">
              14일 무료 체험 후 결제하세요. 언제든지 취소할 수 있습니다.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl p-8 ${
                  plan.highlighted
                    ? 'bg-primary text-white ring-4 ring-primary-200 scale-105'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <h3 className={`text-xl font-semibold mb-2 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-4 ${plan.highlighted ? 'text-primary-100' : 'text-gray-500'}`}>
                  {plan.description}
                </p>
                <div className="mb-6">
                  <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                    {plan.price === '문의' ? '' : '₩'}{plan.price}
                  </span>
                  {plan.price !== '문의' && (
                    <span className={`text-sm ${plan.highlighted ? 'text-primary-100' : 'text-gray-500'}`}>/월</span>
                  )}
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center text-sm">
                      <CheckCircle className={`w-5 h-5 mr-2 ${plan.highlighted ? 'text-primary-200' : 'text-green-500'}`} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-3 rounded-lg font-medium transition-colors ${
                    plan.highlighted
                      ? 'bg-white text-primary hover:bg-gray-100'
                      : 'bg-primary text-white hover:bg-primary-700'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>

          {/* Addon Section */}
          <div className="mt-16">
            <div className="text-center mb-12">
              <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                전문 애드온
              </h3>
              <p className="text-gray-600">
                어떤 요금제에도 추가할 수 있는 전문 기능 애드온
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {addons.map((addon) => (
                <div
                  key={addon.name}
                  className={`rounded-xl p-8 border-2 ${
                    addon.color === 'green'
                      ? 'border-green-200 bg-green-50'
                      : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div className="flex items-center mb-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      addon.color === 'green' ? 'bg-green-100' : 'bg-amber-100'
                    }`}>
                      <addon.icon className={`w-6 h-6 ${
                        addon.color === 'green' ? 'text-green-600' : 'text-amber-600'
                      }`} />
                    </div>
                    <div className="ml-4">
                      <h4 className="text-xl font-semibold text-gray-900">{addon.name}</h4>
                      <p className="text-sm text-gray-500">{addon.description}</p>
                    </div>
                  </div>
                  <div className="mb-6">
                    <span className="text-3xl font-bold text-gray-900">+₩{addon.price}</span>
                    <span className="text-sm text-gray-500">/월</span>
                  </div>
                  <ul className="space-y-3">
                    {addon.features.map((feature) => (
                      <li key={feature} className="flex items-center text-sm text-gray-700">
                        <CheckCircle className={`w-5 h-5 mr-2 ${
                          addon.color === 'green' ? 'text-green-500' : 'text-amber-500'
                        }`} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              고객들이 말하는 ABC Staff
            </h2>
            <p className="text-xl text-gray-600">
              실제 사용 중인 고객들의 생생한 후기를 확인하세요
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white rounded-xl p-8 shadow-sm">
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6">&quot;{testimonial.quote}&quot;</p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div className="ml-4">
                    <p className="font-semibold text-gray-900">{testimonial.author}</p>
                    <p className="text-sm text-gray-500">{testimonial.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            지금 바로 시작하세요
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            14일 무료 체험으로 ABC Staff의 모든 기능을 경험해보세요
          </p>
          <Link
            href="/auth/register"
            className="inline-flex items-center px-8 py-4 bg-white text-primary text-lg font-medium rounded-lg hover:bg-gray-100 transition-colors"
          >
            무료로 시작하기
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <span className="text-2xl font-bold text-white">ABC Staff</span>
              <p className="mt-4 text-sm">
                식품 프랜차이즈를 위한<br />스마트 인력 관리 솔루션
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">제품</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white">기능</a></li>
                <li><a href="#pricing" className="hover:text-white">요금</a></li>
                <li><a href="#" className="hover:text-white">업데이트</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">회사</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">소개</a></li>
                <li><a href="#" className="hover:text-white">채용</a></li>
                <li><a href="#" className="hover:text-white">연락처</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">법적 고지</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">이용약관</a></li>
                <li><a href="#" className="hover:text-white">개인정보처리방침</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-800 text-sm text-center">
            <p>&copy; 2024 ABC Staff. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
