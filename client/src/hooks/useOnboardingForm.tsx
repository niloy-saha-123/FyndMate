import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { UserProfile } from "../services/profileService";

export type OnboardingData = {
  fullName: string;
  birthDate: string | null;
  gender: string | null;
};

type OnboardingContextType = {
  data: OnboardingData;
  update: (next: Partial<OnboardingData>) => void;
  reset: (next?: OnboardingData) => void;
};

const defaultData: OnboardingData = {
  fullName: "",
  birthDate: null,
  gender: null,
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({
  children,
  initialProfile,
}: {
  children: ReactNode;
  initialProfile?: UserProfile | null;
}) {
  const startingData = useMemo<OnboardingData>(() => {
    if (!initialProfile) return defaultData;
    return {
      fullName: initialProfile.fullName ?? "",
      birthDate: initialProfile.birthDate ?? null,
      gender: initialProfile.gender ?? null,
    };
  }, [initialProfile]);

  const [data, setData] = useState<OnboardingData>(startingData);

  const update = (next: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...next }));
  };

  const reset = (next?: OnboardingData) => {
    setData(next ?? defaultData);
  };

  return (
    <OnboardingContext.Provider value={{ data, update, reset }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboardingForm() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboardingForm must be used within OnboardingProvider");
  return ctx;
}
