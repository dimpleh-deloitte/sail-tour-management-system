// MOCK dev login only (SSoT §25: real SSO provider is TBD). Lists the mock
// HCM directory so you can sign in as any demo role without a real IdP.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api/client.js";
import { useSession } from "../hooks/use-session.js";
import { SailLogo } from "../components/shared/sail-logo.js";
import { Card, CardBody } from "../components/ui/card.js";

interface DirectoryEntry {
  personNumber: string;
  name: string;
  roles: string[];
}

export function LoginPage() {
  const { devLogin } = useSession();
  const navigate = useNavigate();
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<DirectoryEntry[]>("/auth/dev-directory").then(setDirectory).catch(() => setDirectory([]));
  }, []);

  async function signInAs(personNumber: string) {
    setError(null);
    try {
      await devLogin(personNumber);
      navigate("/");
    } catch {
      setError("Sign-in failed.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-steel-900 via-sail-900 to-sail-700 px-4 blueprint-bg">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="w-full max-w-md">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-sail-700 to-sail-500 px-6 py-8 text-center text-white">
            <div className="mx-auto flex w-fit items-center justify-center rounded-xl bg-white/95 px-3 py-2">
              <SailLogo />
            </div>
            <p className="mt-4 text-sm font-medium">Tour Management System</p>
            <p className="mt-0.5 text-xs text-sail-100">Digital Transformation Initiative</p>
          </div>
          <CardBody>
            <p className="mb-4 text-center text-xs text-steel-500">
              Development sign-in. Pick a demo identity:
            </p>
            <div className="space-y-2">
              {directory.map((d) => (
                <button
                  key={d.personNumber}
                  onClick={() => signInAs(d.personNumber)}
                  className="flex w-full items-center justify-between rounded-xl border border-steel-200 px-4 py-3 text-left text-sm transition-all hover:border-sail-500 hover:bg-sail-50 hover:shadow-sm active:scale-[0.99]"
                >
                  <span>
                    <span className="font-medium text-steel-800">{d.name}</span>
                    <span className="ml-2 text-xs text-steel-500">{d.personNumber}</span>
                  </span>
                  <span className="rounded-full bg-steel-100 px-2 py-0.5 text-[11px] text-steel-500">{d.roles.join(", ")}</span>
                </button>
              ))}
            </div>
            {error && <p className="mt-3 text-center text-xs text-red-600">{error}</p>}
          </CardBody>
        </Card>
      </motion.div>
    </div>
  );
}
