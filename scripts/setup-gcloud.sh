#!/bin/bash
set -euo pipefail

# ============================================================
# 事前に以下を編集してから実行してください
# ============================================================
PROJECT_ID="collaborative-novel-engine"          # Google Cloud プロジェクトID
SUPABASE_URL="https://aiawwfgtjuuxzgcqvujn.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpYXd3Zmd0anV1eHpnY3F2dWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NjI3MDYsImV4cCI6MjA5MDUzODcwNn0.bOSWPOcwSKi7Lb3Mnatr9rLyGNBt8UEUwUaXaY3aKdY"
REGION="asia-northeast1"
SERVICE_NAME="collaborative-novel"
# ============================================================

echo "▶ Google Cloud APIs を有効化..."
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project="$PROJECT_ID"

echo "▶ Artifact Registry リポジトリを作成..."
gcloud artifacts repositories create novel \
  --repository-format=docker \
  --location="$REGION" \
  --project="$PROJECT_ID" 2>/dev/null || echo "  (既存のリポジトリをスキップ)"

echo "▶ Secret Manager にシークレットを登録..."
printf '%s' "$SUPABASE_URL" | \
  gcloud secrets create NEXT_PUBLIC_SUPABASE_URL --data-file=- --project="$PROJECT_ID" 2>/dev/null || \
  printf '%s' "$SUPABASE_URL" | \
  gcloud secrets versions add NEXT_PUBLIC_SUPABASE_URL --data-file=- --project="$PROJECT_ID"

printf '%s' "$SUPABASE_ANON_KEY" | \
  gcloud secrets create NEXT_PUBLIC_SUPABASE_ANON_KEY --data-file=- --project="$PROJECT_ID" 2>/dev/null || \
  printf '%s' "$SUPABASE_ANON_KEY" | \
  gcloud secrets versions add NEXT_PUBLIC_SUPABASE_ANON_KEY --data-file=- --project="$PROJECT_ID"

# SITE_URL は初回デプロイ後に実際の Cloud Run URL で上書きします
printf '%s' "https://placeholder.example.com" | \
  gcloud secrets create NEXT_PUBLIC_SITE_URL --data-file=- --project="$PROJECT_ID" 2>/dev/null || \
  echo "  NEXT_PUBLIC_SITE_URL は既に存在します（スキップ）"

echo "▶ Cloud Build サービスアカウントに権限を付与..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" --role="roles/run.admin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" --role="roles/artifactregistry.writer"

gcloud iam service-accounts add-iam-policy-binding \
  "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --project="$PROJECT_ID"

echo ""
echo "✅ セットアップ完了！"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "次のステップ（手動）:"
echo "1. GitHub を Cloud Build に接続:"
echo "   https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID"
echo ""
echo "2. トリガーを作成:"
echo "   リポジトリ: このリポジトリ"
echo "   ブランチ: ^main$"
echo "   構成: cloudbuild.yaml"
echo "   代入変数: _REGION=$REGION, _SERVICE_NAME=$SERVICE_NAME"
echo ""
echo "3. 初回デプロイ後、Cloud Run の URL を取得して SITE_URL を更新:"
echo "   SITE_URL=\$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')"
echo "   printf '%s' \"\$SITE_URL\" | gcloud secrets versions add NEXT_PUBLIC_SITE_URL --data-file=-"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
