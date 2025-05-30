import os

estructura = [
    "src/app.js",
    "src/server.js",
    "src/config/index.js",
    "src/config/database.js",
    "src/config/logger.js",
    "src/database/schema.prisma",
    "src/database/migrations/.gitkeep",
    "src/services/whatsappService.js",
    "src/services/aiService.js",
    "src/services/ragService.js",
    "src/services/documentService.js",
    "src/services/sheetsService.js",
    "src/services/emailService.js",
    "src/core/conversationManager.js",
    "src/core/fieldTracker.js",
    "src/core/completionChecker.js",
    "src/controllers/webhookController.js",
    "src/controllers/simulatorController.js",
    "src/controllers/adminController.js",
    "src/middleware/errorHandler.js",
    "src/middleware/validation.js",
    "src/middleware/auth.js",
    "src/routes/index.js",
    "src/routes/webhooks.js",
    "src/routes/admin.js",
    "src/routes/simulator.js",
    "src/utils/constants.js",
    "src/utils/helpers.js",
    "src/utils/validators.js",
    "src/types/index.js",
    "src/types/schemas.js",
    "knowledge-base/real-estate-data.json",
    "scripts/simulate-form.js",
    "scripts/load-knowledge.js",
    "scripts/test-conversation.js",
    "tests/unit/.gitkeep",
    "tests/integration/.gitkeep",
    ".env.example",
    ".env",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    ".gitignore",
    "README.md",
    "Dockerfile"
]

for path in estructura:
    dir_name = os.path.dirname(path)
    if dir_name and not os.path.exists(dir_name):
        os.makedirs(dir_name, exist_ok=True)
    if not path.endswith("/"):
        with open(path, "w", encoding="utf-8") as f:
            pass

print("✅ Estructura del proyecto Node.js creada con éxito.")
