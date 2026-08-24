# TechStore Commerce

TechStore sells catalog variants through delivery or pickup while keeping one sellable-stock ceiling across every fulfillment path.

## Language

**Store**:
An active physical location where a customer can collect an Order.
_Avoid_: Branch, shop

**Network Stock**:
The canonical sellable quantity of a Variant across TechStore; every Order reserves against this ceiling.
_Avoid_: Global stock, warehouse stock

**Pickup Allocation**:
The maximum Network Stock a Store may promise for pickup. A pickup Order reserves both Network Stock and this allocation.
_Avoid_: Store stock, branch inventory

**Fulfillment Method**:
How an Order reaches the customer: `delivery` to an address or `pickup` at a Store.
_Avoid_: Shipping type, delivery mode

**Staff Account**:
An individual workforce identity with one server-authoritative role: Admin, Manager, or Staff.
_Avoid_: Shared admin, admin secret, employee login
