"use client";

import { useActionState } from "react";
import {
  submitCheckoutAction,
  type CheckoutFormState,
} from "@/features/online-storefront/application/checkout-form-action";

/**
 * Storefront checkout form (`/tienda`, spec "Cart, discounts, shipping,
 * fulfillment, checkout"). Builds a mixed-flavor pack selection and/or
 * individually-sold flavor quantities in ONE form submission — a deliberate
 * MVP simplification (documented deviation, see apply-progress): this is
 * NOT a persistent multi-page shopping cart with an "add item" round trip,
 * since no spec scenario requires cart persistence across page navigations.
 * All authoritative validation (availability/eligibility/pricing) happens
 * server-side in `placeCustomerOrder`, not here — this form only collects
 * the customer's raw choices.
 *
 * Field naming follows `parse-checkout-form.ts`'s documented convention
 * exactly (`pack_<packId>_flavor_<flavorId>`, `flavor_<flavorId>`,
 * `fulfillment`, `postalCode`, `paymentMethod`, `discountCode`).
 */
interface FlavorOption {
  id: string;
  name: string;
}

interface PackOption {
  id: string;
  name: string;
  unitCount: number;
  flavorOptions: FlavorOption[];
}

export function CheckoutForm({ flavors, packs }: { flavors: FlavorOption[]; packs: PackOption[] }) {
  const context = {
    packs: packs.map((pack) => ({
      id: pack.id,
      flavorIds: pack.flavorOptions.map((flavor) => flavor.id),
    })),
    flavorIds: flavors.map((flavor) => flavor.id),
  };
  const boundAction = submitCheckoutAction.bind(null, context);
  const initialState: CheckoutFormState = { status: "idle" };
  const [state, formAction, isPending] = useActionState(boundAction, initialState);

  if (state.status === "success") {
    return (
      <section>
        <h2>¡Pedido confirmado!</h2>
        <p>Número de pedido: {state.orderId}</p>
        <p>Total: ${state.total}</p>
        <p>{state.paymentInstructions.message}</p>
        {state.paymentInstructions.transferAlias ? (
          <p>Alias para transferir: {state.paymentInstructions.transferAlias}</p>
        ) : null}
      </section>
    );
  }

  return (
    <form action={formAction}>
      <h2>Tu pedido</h2>

      {packs.map((pack) => (
        <fieldset key={pack.id}>
          <legend>
            {pack.name} ({pack.unitCount} unidades)
          </legend>
          {pack.flavorOptions.map((flavor) => (
            <label key={flavor.id}>
              {flavor.name}
              <input
                type="number"
                min={0}
                name={`pack_${pack.id}_flavor_${flavor.id}`}
                defaultValue={0}
              />
            </label>
          ))}
        </fieldset>
      ))}

      <fieldset>
        <legend>Sabores individuales</legend>
        {flavors.map((flavor) => (
          <label key={flavor.id}>
            {flavor.name}
            <input type="number" min={0} name={`flavor_${flavor.id}`} defaultValue={0} />
          </label>
        ))}
      </fieldset>

      <label>
        Código de descuento
        <input name="discountCode" />
      </label>

      <fieldset>
        <legend>Entrega</legend>
        <label>
          <input type="radio" name="fulfillment" value="pickup" defaultChecked /> Retiro en local
        </label>
        <label>
          <input type="radio" name="fulfillment" value="delivery" /> Envío a domicilio
        </label>
      </fieldset>

      <label>
        Código postal (solo para envío)
        <input name="postalCode" />
      </label>

      <fieldset>
        <legend>Método de pago</legend>
        <label>
          <input type="radio" name="paymentMethod" value="cash" defaultChecked /> Efectivo al
          retirar/recibir
        </label>
        <label>
          <input type="radio" name="paymentMethod" value="transfer" /> Transferencia bancaria
        </label>
      </fieldset>

      <button type="submit" disabled={isPending}>
        Finalizar pedido
      </button>

      {state.status === "error" ? <p role="alert">{state.message}</p> : null}
    </form>
  );
}
