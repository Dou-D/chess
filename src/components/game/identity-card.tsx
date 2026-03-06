import { Copy } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

type IdentityCardProps = {
  userId: string | null;
  loading: boolean;
  notice: string | null;
  onCopy: () => void;
};

export function IdentityCard({
  userId,
  loading,
  notice,
  onCopy,
}: IdentityCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>我的身份</CardTitle>
        <CardDescription>把 ID 发给朋友来开始对战。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-stone-500">正在初始化...</p>
        ) : (
          <>
            <p className="break-all rounded-md bg-stone-100 p-2 font-mono text-sm text-stone-800">
              {userId}
            </p>
            <Button onClick={onCopy} className="w-full sm:w-auto">
              <Copy className="mr-2 h-4 w-4" />
              复制我的 ID
            </Button>
          </>
        )}
        {notice ? <Badge variant="success">{notice}</Badge> : null}
      </CardContent>
    </Card>
  );
}
