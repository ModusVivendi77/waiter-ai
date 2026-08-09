#!/bin/bash

# Waiter AI — Environment Setup Verification Script
# This script checks if your Supabase configuration is correct

set -e

echo "🔍 Verifying Waiter AI Supabase Setup..."
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ .env.local not found!"
    echo ""
    echo "📝 Please create .env.local by copying .env.example:"
    echo "   cp .env.example .env.local"
    echo ""
    echo "   Then fill in your Supabase credentials from:"
    echo "   https://app.supabase.com/project/[your-project]/settings/api"
    echo ""
    exit 1
fi

echo "✅ .env.local found"
echo ""

# Check required variables
required_vars=("NEXT_PUBLIC_SUPABASE_URL" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "SUPABASE_SERVICE_ROLE_KEY")

missing_vars=()
for var in "${required_vars[@]}"; do
    value=$(grep "^${var}=" .env.local | cut -d'=' -f2 | tr -d ' ')
    
    if [ -z "$value" ] || [ "$value" = "your-*-here" ] || [ "$value" = "" ]; then
        missing_vars+=("$var")
        echo "❌ $var is not set"
    else
        # Show first 10 chars and last 10 chars for verification
        echo "✅ $var is configured"
    fi
done

echo ""

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "⚠️  Missing or empty variables:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please update .env.local with your Supabase credentials:"
    echo "See SUPABASE_SETUP.md for instructions"
    exit 1
fi

echo "✅ All environment variables configured!"
echo ""
echo "🚀 You're ready to proceed with Task 1.3 (Vercel Setup)"
echo ""
echo "Next steps:"
echo "  1. npm run dev        (start dev server)"
echo "  2. Check console for Supabase connection errors"
echo "  3. Proceed to database migrations (Phase 2)"
