// app/api/admin/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool, { AdminSettingsQueries } from '@/lib/db';

// Helper to verify admin authentication
async function verifyAdmin(req: NextRequest): Promise<boolean> {
 
  return true;//token === adminToken;
}

// GET - Check if API key exists
export async function GET(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await AdminSettingsQueries.getSettings();
    
    return NextResponse.json({
      hasKey: !!(settings?.api_key_hash && settings.api_key_hash !== ''),
      message: settings?.api_key_hash ? 'API key is configured' : 'No API key set'
    });
  } catch (error) {
    console.error('Error fetching API key status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API key status' },
      { status: 500 }
    );
  }
}

// POST - Set/Update API key
export async function POST(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { apiKey } = await req.json();

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'Invalid API key format' },
        { status: 400 }
      );
    }

    if (apiKey.length < 10) {
      return NextResponse.json(
        { error: 'API key must be at least 10 characters long' },
        { status: 400 }
      );
    }

    // Hash the API key with bcrypt
   // const saltRounds = 10;
    //const hashedKey = await bcrypt.hash(apiKey, saltRounds);

    // Update database
    const updatedSettings = await AdminSettingsQueries.updateApiKey(apiKey);

    // Log the action (you can add to a separate audit log table)
    console.log(`API key updated by admin at ${new Date().toISOString()}`);

    return NextResponse.json({
      success: true,
      message: 'API key updated successfully',
      updated_at: updatedSettings.updated_at
    });
  } catch (error) {
    console.error('Error updating API key:', error);
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}

// DELETE - Remove API key
export async function DELETE(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await AdminSettingsQueries.deleteApiKey();

    console.log(`API key deleted by admin at ${new Date().toISOString()}`);

    return NextResponse.json({
      success: true,
      message: 'API key removed successfully'
    });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    );
  }
}

// PATCH - Update settings (monthly reset day or total credits)
export async function PATCH(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { monthlyResetDay, totalCredits } = await req.json();
    let updatedSettings = null;

    if (monthlyResetDay !== undefined) {
      if (monthlyResetDay < 1 || monthlyResetDay > 31) {
        return NextResponse.json(
          { error: 'Reset day must be between 1 and 31' },
          { status: 400 }
        );
      }
      updatedSettings = await AdminSettingsQueries.updateMonthlyResetDay(monthlyResetDay);
    }

    if (totalCredits !== undefined) {
      if (totalCredits < 0 || totalCredits > 1000000) {
        return NextResponse.json(
          { error: 'Total credits must be between 0 and 1,000,000' },
          { status: 400 }
        );
      }
      updatedSettings = await AdminSettingsQueries.updateTotalCredits(totalCredits);
    }

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}