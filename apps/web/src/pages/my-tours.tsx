import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ClipboardList } from "lucide-react";
import { api } from "../api/client.js";
import { TourRequestRecord } from "../types.js";
import { Card, CardBody } from "../components/ui/card.js";
import { CardSkeleton } from "../components/ui/skeleton.js";
import { EmptyState } from "../components/ui/empty-state.js";
import { StatusChip } from "../components/shared/status-chip.js";

export function MyToursPage() {
  const [tours, setTours] = useState<TourRequestRecord[] | null>(null);

  useEffect(() => {
    api.get<TourRequestRecord[]>("/tours/mine").then(setTours);
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-steel-800">My Tours</h1>
      <p className="mt-1 text-sm text-steel-500">Your own tour requests — draft, submitted and past.</p>

      <div className="mt-6 space-y-3">
        {tours === null && [0, 1, 2].map((i) => <CardSkeleton key={i} />)}
        {tours?.length === 0 && (
          <Card><EmptyState icon={ClipboardList} title="No tour requests found" subtitle="Create your first tour request from Add Tour." /></Card>
        )}
        {tours?.map((t, i) => (
          <motion.div key={t.requestId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Link to={`/tours/${t.requestId}`}>
              <Card hover>
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm text-steel-800">{t.requestNumber}</p>
                    <p className="mt-0.5 text-xs text-steel-500">
                      {t.destCode} · {t.travelStartDate} — {t.travelEndDate} · {t.tourType}
                    </p>
                  </div>
                  <StatusChip status={t.status} />
                </CardBody>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
