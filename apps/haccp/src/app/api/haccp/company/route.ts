import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company_id
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get company details
    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', userData.company_id)
      .single();

    if (error) {
      console.error('Error fetching company:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Map to expected format for invoice
    return NextResponse.json({
      name: company.name,
      business_number: company.business_number,
      representative: company.ceo_name,
      address: company.address,
      phone: company.phone,
      fax: company.fax || null,
      email: company.email || null,
    });
  } catch (error) {
    console.error('Error in company API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
