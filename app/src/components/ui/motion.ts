export const motionEase = [0.16, 1, 0.3, 1] as const;
export const motionTransition = (duration = 0.12) => ({ duration, ease: motionEase });
