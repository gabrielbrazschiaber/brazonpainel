import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

/** Placeholders da lista de leads (mobile: cards). */
export function LeadsSkeletonCards({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="space-y-3 sm:hidden" aria-hidden="true">
      {Array.from({ length: linhas }).map((_, i) => (
        <Card key={i} className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="w-full space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16 justify-self-end" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-20 justify-self-end" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Placeholders da lista de leads (desktop: linhas de tabela). */
export function LeadsSkeletonRows({ linhas = 5 }: { linhas?: number }) {
  return (
    <>
      {Array.from({ length: linhas }).map((_, i) => (
        <TableRow key={i} aria-hidden="true">
          <TableCell>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="ml-auto h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="ml-auto h-4 w-8" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="ml-auto h-8 w-16" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
