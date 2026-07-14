'use client';

import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type PraktijkplannerContextData,
  usePraktijkplannerContext,
} from '@/hooks/praktijkplanner/usePraktijkplannerContext';

export type PraktijkplannerPageContext = {
  groupId: number;
  groupName: string | null;
  data: PraktijkplannerContextData;
  reload: () => void;
};

export function PraktijkplannerPage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: (context: PraktijkplannerPageContext) => ReactNode;
}) {
  const context = usePraktijkplannerContext();

  if (context.loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6" role="status">
        <p className="text-muted-foreground">Praktijkplanner laden…</p>
      </div>
    );
  }

  if (!context.data || !context.groupId) {
    return (
      <div className="p-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{context.error ?? 'De Praktijkplanner is niet beschikbaar.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-w-[1024px] space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
          {context.groupName ?? 'Waarneemgroep'}
        </span>
      </div>
      {children({
        groupId: context.groupId,
        groupName: context.groupName,
        data: context.data,
        reload: context.reload,
      })}
    </div>
  );
}
