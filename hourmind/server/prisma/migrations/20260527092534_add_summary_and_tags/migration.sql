-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "summary" TEXT;

-- CreateTable
CREATE TABLE "ConversationTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationTag_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ConversationTag_tag_idx" ON "ConversationTag"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationTag_conversationId_tag_key" ON "ConversationTag"("conversationId", "tag");
