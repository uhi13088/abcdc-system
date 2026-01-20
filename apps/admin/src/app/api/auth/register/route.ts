import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import { logger } from '@abc/shared';

// 비밀번호 유효성 검사: 8자 이상, 특수문자 포함
function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: '비밀번호는 최소 8자 이상이어야 합니다.' };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, message: '비밀번호에 특수문자를 포함해야 합니다.' };
  }
  if (!/[A-Za-z]/.test(password)) {
    return { valid: false, message: '비밀번호에 영문자를 포함해야 합니다.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '비밀번호에 숫자를 포함해야 합니다.' };
  }
  return { valid: true, message: '' };
}

// 주민등록번호 유효성 검사
function validateSSN(ssn: string): { valid: boolean; message: string } {
  // 하이픈 제거
  const cleanSSN = ssn.replace(/-/g, '');

  if (cleanSSN.length !== 13) {
    return { valid: false, message: '주민등록번호는 13자리여야 합니다.' };
  }

  if (!/^\d{13}$/.test(cleanSSN)) {
    return { valid: false, message: '주민등록번호는 숫자만 입력해야 합니다.' };
  }

  // 주민등록번호 검증 알고리즘
  const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  let sum = 0;

  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanSSN[i]) * weights[i];
  }

  const checkDigit = (11 - (sum % 11)) % 10;

  if (checkDigit !== parseInt(cleanSSN[12])) {
    return { valid: false, message: '유효하지 않은 주민등록번호입니다.' };
  }

  return { valid: true, message: '' };
}

// 주민등록번호 암호화
function encryptSSN(ssn: string): string {
  const algorithm = 'aes-256-gcm';
  const secretKey = process.env.SSN_ENCRYPTION_KEY || 'default-key-change-in-production-32';
  const key = crypto.scryptSync(secretKey, 'salt', 32);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(ssn.replace(/-/g, ''), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // iv:authTag:encrypted 형태로 저장
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

// 주민등록번호 해시 (중복 검사용)
function hashSSN(ssn: string): string {
  const cleanSSN = ssn.replace(/-/g, '');
  return crypto.createHash('sha256').update(cleanSSN).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      name,
      phone,
      address,
      addressDetail,
      ssn,
      birthDate,
      // 회사 정보 (선택)
      companyName,
      businessNumber,
      companyAddress,
      companyPhone,
    } = body;

    // 필수 필드 검증
    if (!email || !password || !name || !phone || !ssn || !address) {
      return NextResponse.json(
        { error: '이메일, 비밀번호, 이름, 전화번호, 주민등록번호, 주소는 필수입니다.' },
        { status: 400 }
      );
    }

    // 비밀번호 유효성 검사
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.message },
        { status: 400 }
      );
    }

    // 주민등록번호 유효성 검사
    const ssnValidation = validateSSN(ssn);
    if (!ssnValidation.valid) {
      return NextResponse.json(
        { error: ssnValidation.message },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 주민등록번호 중복 검사 (해시로 비교) - ssn_hash 컬럼이 있는 경우에만
    const ssnHash = hashSSN(ssn);
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('ssn_hash', ssnHash)
        .single();

      if (existingUser) {
        return NextResponse.json(
          { error: '이미 등록된 주민등록번호입니다.' },
          { status: 400 }
        );
      }
    } catch {
      // ssn_hash 컬럼이 없거나 에러 발생 시 무시 (첫 사용자일 수 있음)
      logger.log('SSN hash check skipped (column may not exist yet)');
    }

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('Auth error:', authError);
      if (authError.message.includes('already been registered')) {
        return NextResponse.json(
          { error: '이미 등록된 이메일입니다.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: '사용자 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 2. Create or get company (if company name provided)
    let companyId = null;
    if (companyName) {
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('name', companyName)
        .single();

      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert({
            name: companyName,
            business_number: businessNumber || null,
            address: companyAddress || null,
            phone: companyPhone || null,
            status: 'ACTIVE',
          })
          .select('id')
          .single();

        if (companyError) {
          console.error('Company creation error:', companyError);
        } else {
          companyId = newCompany.id;
        }
      }
    }

    // 주민등록번호에서 생년월일 추출 (birthDate가 없는 경우)
    let calculatedBirthDate = birthDate;
    if (!calculatedBirthDate && ssn) {
      const cleanSSN = ssn.replace(/-/g, '');
      const yearPrefix = parseInt(cleanSSN[6]) <= 2 ? '19' : '20';
      const year = yearPrefix + cleanSSN.substring(0, 2);
      const month = cleanSSN.substring(2, 4);
      const day = cleanSSN.substring(4, 6);
      calculatedBirthDate = `${year}-${month}-${day}`;
    }

    // 주소 합치기
    const fullAddress = addressDetail ? `${address} ${addressDetail}` : address;

    // 3. Create user profile in users table
    // 먼저 ssn_hash 포함해서 시도, 실패하면 ssn_hash 없이 재시도
    let userData;
    let userError;

    const userDataWithHash = {
      auth_id: authData.user.id,
      email: email,
      name: name,
      phone: phone,
      address: fullAddress,
      ssn_encrypted: encryptSSN(ssn),
      ssn_hash: ssnHash,
      birth_date: calculatedBirthDate,
      role: 'company_admin',
      status: 'ACTIVE',
      company_id: companyId,
    };

    const result1 = await supabase
      .from('users')
      .insert(userDataWithHash)
      .select()
      .single();

    if (result1.error && result1.error.message.includes('ssn_hash')) {
      // ssn_hash 컬럼이 없으면 제외하고 재시도
      logger.log('Retrying without ssn_hash column');
      const { ssn_hash, ...userDataWithoutHash } = userDataWithHash;
      const result2 = await supabase
        .from('users')
        .insert(userDataWithoutHash)
        .select()
        .single();
      userData = result2.data;
      userError = result2.error;
    } else {
      userData = result1.data;
      userError = result1.error;
    }

    if (userError) {
      console.error('User profile error:', userError);
      // Rollback: delete auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: '사용자 프로필 생성에 실패했습니다: ' + userError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
      },
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
