import type { FieldKey } from '@/types/properties';

import type { BasicInfoValues } from '@/components/admin/properties/create/BasicInfoSection';
import type { CharacteristicRowValues } from '@/components/admin/properties/create/CharacteristicsSection';
import type { FeaturesValues } from '@/components/admin/properties/create/FeaturesSection';
import type { AddressValues } from '@/components/property/AddressField';

type FormValues = BasicInfoValues & AddressValues & FeaturesValues;

export interface StepDefinition {
  label: string;
  done: boolean;
  hasError: boolean;
}

export interface UsePropertyCreateStepperResult {
  steps: StepDefinition[];
  completedSteps: number;
}

/**
 * Derive stepper state from form values and field errors.
 * Pure computation — no side effects or memoization.
 */
export function usePropertyCreateStepper(
  values: FormValues,
  fieldErrors: Partial<Record<FieldKey, string>>,
  featuresEnabled: boolean,
  characteristics: readonly CharacteristicRowValues[],
): UsePropertyCreateStepperResult {
  const basicDone = values.propertyType !== '';
  const addressDone =
    values.addressFormatted !== '' && values.addressCity !== '' && values.addressCountry !== '';
  const featuresDone =
    !featuresEnabled ||
    (values.featuresTotalAreaM2 !== '' &&
      values.featuresCoveredAreaM2 !== '' &&
      values.featuresConservationState !== '');
  const tagsDone = characteristics.length > 0;
  const completedSteps = [basicDone, addressDone, featuresDone, tagsDone].filter(Boolean).length;

  const steps: StepDefinition[] = [
    {
      label: 'Datos básicos',
      done: basicDone,
      hasError: Boolean(
        fieldErrors.internalCode ??
        fieldErrors.propertyType ??
        fieldErrors.status ??
        fieldErrors.ownerProfileId ??
        fieldErrors.agentProfileId,
      ),
    },
    {
      label: 'Dirección',
      done: addressDone,
      hasError: Boolean(
        fieldErrors.addressFormatted ??
        fieldErrors.addressCity ??
        fieldErrors.addressCountry ??
        fieldErrors.addressPlaceId ??
        fieldErrors.addressStreet ??
        fieldErrors.addressStreetNumber ??
        fieldErrors.addressNeighborhood ??
        fieldErrors.addressState ??
        fieldErrors.addressPostalCode ??
        fieldErrors.addressLatitude ??
        fieldErrors.addressLongitude,
      ),
    },
    {
      label: 'Física',
      done: featuresDone,
      hasError: Boolean(
        fieldErrors.featuresTotalAreaM2 ??
        fieldErrors.featuresCoveredAreaM2 ??
        fieldErrors.featuresConservationState ??
        fieldErrors.featuresRooms ??
        fieldErrors.featuresBedrooms ??
        fieldErrors.featuresBathrooms ??
        fieldErrors.featuresGarages ??
        fieldErrors.featuresFloor ??
        fieldErrors.featuresAgeYears,
      ),
    },
    {
      label: 'Adicionales',
      done: tagsDone,
      hasError: Boolean(fieldErrors.characteristics),
    },
  ];

  return { steps, completedSteps };
}
