# LIEN Photography

## 專案結構

```text
src/
├── components/
│   ├── admin/       # 後台登入、管理與上傳
│   ├── common/      # 跨功能共用元件
│   ├── gallery/     # 作品集、圖片與檢視器
│   ├── layout/      # 導覽、頁尾與頁面控制
│   ├── media/       # 背景影音與手機捲動體驗
│   ├── sections/    # 首頁內容區塊
│   ├── system/      # 錯誤處理與效能監測
│   └── ui/          # 基礎 UI 元件
├── config/          # 應用程式設定
├── contexts/        # React Context
├── services/        # Firebase、郵件與影像分類
├── styles/          # 全域樣式
├── types/           # 共用型別
└── utils/           # 共用工具函式

public/
├── assets/images/   # 圖片
├── assets/videos/   # 影音
└── *.html           # 固定網址的政策頁

config/
├── env/              # Vite 環境變數（依 .env.example 建立本機設定）
├── firebase/         # Firebase 規則、索引與輔助設定
└── vite.config.ts    # Vite 設定
```

只有 npm、Vite 入口、TypeScript 專案設定與 Firebase CLI 入口保留在根目錄。`build/` 是可重建的正式環境輸出，不納入版本管理。

## 常用指令

```bash
npm run dev
npm run typecheck
npm run build
```

本機環境值放在 `config/env/.env.local`，不可提交實際金鑰。
