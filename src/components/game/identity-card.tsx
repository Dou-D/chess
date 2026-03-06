import { Copy } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

type IdentityCardProps = {
  publicIdDraft: string;
  myPublicId: string;
  loading: boolean;
  busy: boolean;
  notice: string | null;
  onPublicIdChange: (value: string) => void;
  onSavePublicId: () => Promise<void>;
  onCopy: () => void;
};

export function IdentityCard({
  publicIdDraft,
  myPublicId,
  loading,
  busy,
  notice,
  onPublicIdChange,
  onSavePublicId,
  onCopy,
}: IdentityCardProps) {
  const handleSave = async () => {
    await onSavePublicId();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>我的身份</CardTitle>
        <CardDescription>手动设置你的对战 ID（4-24 位）。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-stone-500">正在初始化...</p>
        ) : (
          <>
            <Input
              value={publicIdDraft}
              onChange={(event) => onPublicIdChange(event.target.value)}
              placeholder="例如: chess_fox"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                disabled={busy || !publicIdDraft.trim()}
                onClick={handleSave}
              >
                保存对战 ID
              </Button>
              <Button
                variant="secondary"
                disabled={!myPublicId}
                onClick={onCopy}
                className="w-full sm:w-auto"
              >
                <Copy className="mr-2 h-4 w-4" />
                复制我的对战 ID
              </Button>
            </div>
            <p className="text-xs text-stone-500">
              只允许字母、数字、下划线、短横线。
            </p>
            <p className="break-all rounded-md bg-stone-100 p-2 font-mono text-sm text-stone-800">
              当前对战 ID: {myPublicId || "未设置"}
            </p>
          </>
        )}
        {notice ? <Badge variant="success">{notice}</Badge> : null}
      </CardContent>
    </Card>
  );
}
