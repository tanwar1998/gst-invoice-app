export const GSTIN_VALIDATOR = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function validateBillingForm({ cart, customer, gstinInvalid }) {
  const errors = {};
  if (customer.name.trim().length < 2) errors.name = 'Customer name is required.';
  if (gstinInvalid) errors.gstin = 'Enter a valid 15-character GSTIN.';
  if (!cart.length) errors.cart = 'Add at least one product.';

  const badQuantity = cart.find((item) => !(Number(item.quantity) > 0));
  if (badQuantity) errors.cart = 'All quantities must be greater than zero.';

  return errors;
}
