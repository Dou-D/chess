import { useState } from "react";
import type { Invite } from "../../types/game";
import { shortId } from "../../lib/gomoku";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";

type InviteCardProps = {
  loading: boolean;
  busy: boolean;
  outgoingInvites: Invite[];
  incomingInvites: Invite[];
  onSendInvite: (targetId: string) => Promise<void>;
  onRespondInvite: (invite: Invite, accepted: boolean) => Promise<void>;
};

export function InviteCard({
  loading,
  busy,
  outgoingInvites,
  incomingInvites,
  onSendInvite,
  onRespondInvite,
}: InviteCardProps) {
  const [targetId, setTargetId] = useState("");

  const handleSend = async () => {
    await onSendInvite(targetId);
    setTargetId("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>邀请对战</CardTitle>
        <CardDescription>输入对方 ID，等待对方同意后自动开局。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            placeholder="粘贴对方用户 ID"
          />
          <Button disabled={busy || loading} onClick={handleSend}>
            发送邀请
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-stone-700">我发出的邀请</p>
          {outgoingInvites.length === 0 ? (
            <p className="text-sm text-stone-500">暂无待处理邀请</p>
          ) : (
            <div className="space-y-2">
              {outgoingInvites.map((invite) => (
                <Badge key={invite.id} variant="secondary" className="mr-2">
                  发给 {shortId(invite.to_user)} (等待中)
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-stone-700">收到的邀请</p>
          {incomingInvites.length === 0 ? (
            <p className="text-sm text-stone-500">暂无邀请</p>
          ) : (
            <div className="space-y-3">
              {incomingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-2 rounded-lg border border-stone-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-sm text-stone-700">
                    {shortId(invite.from_user)} 邀请你对战
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => onRespondInvite(invite, true)}
                    >
                      同意
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => onRespondInvite(invite, false)}
                    >
                      拒绝
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
