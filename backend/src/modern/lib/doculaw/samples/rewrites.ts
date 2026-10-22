/* ─────────────────────────────────────────────────────────
 * Hand-written rewrites for the sample lease, every clause at
 * every level. Keyed by clause citation (stable: the parser is
 * deterministic and a test checks full coverage).
 *
 *   lawyer  same meaning, modern drafting, less clutter
 *   plain   everyday words, short sentences, every number kept
 *   eli5    the simplest possible version
 *
 * Section headings with no body share one summary across levels.
 * v2 only overrides the clauses whose text changed.
 * ───────────────────────────────────────────────────────── */

import type { Level } from "../types";

export type FixtureRewrite = Record<Level, string>;

const same = (s: string): FixtureRewrite => ({ lawyer: s, plain: s, eli5: s });

const renewal = (days: number): FixtureRewrite => ({
  lawyer: `At the end of the Initial Term, the Lease renews automatically for successive 12-month Renewal Terms on the same terms, unless either Party gives written notice of non-renewal at least ${days} days before the current term expires.`,
  plain: `When the year ends, the lease renews for another full year on its own. To stop that, the tenant or the landlord has to send written notice at least ${days} days before the term ends.`,
  eli5: `When the year is over, the deal starts again for another year by itself. To leave instead, someone has to send a note at least ${days} days before the end.`,
});

const rent = (amount: string): FixtureRewrite => ({
  lawyer: `Tenant must pay Landlord rent of $${amount}.00 per month ("Rent"), in advance, on or before the 1st day of each month, without demand, deduction, or offset.`,
  plain: `Rent is $${amount} a month, due by the 1st. The tenant pays the full amount on time and can't subtract anything from it, even money the landlord owes them.`,
  eli5: `The renter pays $${amount} every month, by the 1st. They have to pay all of it, every time.`,
});

export const LEASE_V1: Record<string, FixtureRewrite> = {
  Preamble: {
    lawyer: `This Residential Lease Agreement (the "Lease") is made on August 14, 2026 between Bramblecote Properties LLC, a California limited liability company ("Landlord"), and Marlowe Quintero ("Tenant"), each a "Party."`,
    plain: "This lease is a contract between Bramblecote Properties LLC (the landlord) and Marlowe Quintero (the tenant). It's dated August 14, 2026.",
    eli5: "This is a deal between a company that owns an apartment and Marlowe, who wants to live there.",
  },
  "§1": {
    lawyer: `Landlord leases to Tenant the unit at 2217 Tamsin Court, Unit 4, Fernhollow, California 90000 (the "Premises"), with one assigned parking space (Space No. 12) and shared use of the laundry room.`,
    plain: "The tenant rents Unit 4 at 2217 Tamsin Court in Fernhollow, California. It comes with parking space 12 and use of the shared laundry room.",
    eli5: "The renter gets to live in Unit 4. They also get one parking spot (number 12) and can use the laundry room with everyone else.",
  },
  "§2": {
    lawyer: `The Lease runs from September 1, 2026 through 11:59 p.m. on August 31, 2027 (the "Initial Term"), unless ended earlier under this Lease.`,
    plain: "The lease starts September 1, 2026 and ends at 11:59 p.m. on August 31, 2027, unless it ends early under another section.",
    eli5: "The renter lives there for one year: from September 1, 2026 to August 31, 2027.",
  },
  "§3": renewal(30),
  "§4": same("Covers the rent amount, how to pay it, and how it can change."),
  "§4.1": rent("1,850"),
  "§4.2": {
    lawyer: "Rent is payable through Landlord's online resident portal or by personal check delivered to Landlord's office. Each credit or debit card payment carries a $3.95 processing fee.",
    plain: "Pay through the online portal or bring a check to the office. Paying by credit or debit card adds a $3.95 fee each time.",
    eli5: "The renter can pay online or with a check. Paying with a card costs $3.95 extra.",
  },
  "§4.3": {
    lawyer: "Landlord may increase Rent effective at the start of any Renewal Term on at least 30 days' written notice. No single increase may exceed 8% of the Rent then in effect.",
    plain: "At each renewal, the landlord can raise the rent by up to 8%, as long as they give at least 30 days' written notice.",
    eli5: "Each new year, the rent can go up a little, up to 8%. The landlord has to warn the renter 30 days before.",
  },
  "§5": {
    lawyer: "If any Rent payment is not received by 11:59 p.m. on the 5th day of the month it is due:",
    plain: "If rent hasn't arrived by 11:59 p.m. on the 5th, these late fees apply:",
    eli5: "If the rent is late (after the 5th), the renter pays extra:",
  },
  "§5(a)": {
    lawyer: "Tenant must pay a late charge of $75.00; and",
    plain: "A $75 late fee right away.",
    eli5: "$75 the first time it's late.",
  },
  "§5(b)": {
    lawyer: "an additional late charge of $10.00 accrues for each further day the Rent remains unpaid, up to a total of $250.00 in any calendar month.",
    plain: "Then $10 more for every extra day it stays unpaid, up to $250 in total for the month.",
    eli5: "Then $10 more every day it's still late, but never more than $250 in one month.",
  },
  "§6": {
    lawyer: "Tenant must pay $35.00 for each check or electronic payment returned unpaid for any reason. After two returned payments, Landlord may require all future payments by cashier's check or money order.",
    plain: "Each bounced check or failed payment costs the tenant $35. After two, the landlord can insist on cashier's checks or money orders from then on.",
    eli5: "If a payment bounces, the renter pays $35. If it happens twice, they have to pay with a special kind of check.",
  },
  "§7": same("Covers the security deposit: how much, what it can pay for, and when it comes back."),
  "§7(a)": {
    lawyer: `On signing, Tenant must deposit $2,775.00 with Landlord as security for Tenant's obligations (the "Security Deposit").`,
    plain: "When signing, the tenant pays a $2,775 security deposit. The landlord holds it in case the tenant doesn't meet their obligations.",
    eli5: "The renter gives the landlord $2,775 to hold. It's a safety promise that they'll take care of the place.",
  },
  "§7(b)": {
    lawyer: "Landlord may apply all or part of the Security Deposit to:",
    plain: "The landlord can keep part or all of the deposit to cover:",
    eli5: "The landlord can use that money for:",
  },
  "§7(b)(i)": {
    lawyer: "unpaid Rent and other amounts due under the Lease;",
    plain: "Rent or other money the tenant still owes.",
    eli5: "Rent that wasn't paid.",
  },
  "§7(b)(ii)": {
    lawyer: "the cost of repairing damage to the Premises beyond ordinary wear and tear; and",
    plain: "Repairs for damage beyond normal wear and tear.",
    eli5: "Fixing things the renter broke. Normal use, like small scuffs, doesn't count.",
  },
  "§7(b)(iii)": {
    lawyer: "move-out cleaning costs, including professional carpet cleaning, which will be charged in every case regardless of the carpet's condition.",
    plain: "Move-out cleaning, including professional carpet cleaning. The carpet cleaning is charged every time, even if the carpet is spotless.",
    eli5: "Cleaning when the renter leaves. Carpet cleaning always gets taken out, even if the carpet is perfect.",
  },
  "§7(c)": {
    lawyer: "Landlord must return the Security Deposit, less lawful deductions, with an itemized statement of deductions, within 21 days after Tenant vacates and returns all keys.",
    plain: "Within 21 days after the tenant moves out and returns the keys, the landlord returns the deposit minus any allowed deductions, with a list of what was taken out and why.",
    eli5: "After the renter moves out and gives back the keys, the landlord has 21 days to give the money back, with a list of anything they kept.",
  },
  "§7(d)": {
    lawyer: "In addition to the Security Deposit, Tenant must pay a non-refundable administrative fee of $250.00 on signing.",
    plain: "On top of the deposit, the tenant pays a $250 administrative fee at signing. This money is never refunded.",
    eli5: "The renter also pays $250 when signing. They never get this money back.",
  },
  "§8": {
    lawyer: "Tenant must arrange and pay for electricity, gas, internet, and cable. Tenant must also pay a flat monthly utility fee of $65.00 for water, sewer, and trash, payable with Rent.",
    plain: "The tenant sets up and pays for electricity, gas, internet, and cable. Water, sewer, and trash are a flat $65 a month, paid with rent.",
    eli5: "The renter pays for power, heat, and internet. Water and trash cost $65 more each month.",
  },
  "§9": {
    lawyer: "The Premises may be used only as a private residence for Tenant, with no additional occupants. Any guest staying more than 14 days in any 6-month period requires Landlord's prior written consent.",
    plain: "Only the tenant can live here, and only as a home. A guest who stays more than 14 days in any 6 months needs the landlord's written OK first.",
    eli5: "Only the renter lives here. Friends can visit, but if someone stays more than 14 days, the landlord has to say OK in writing.",
  },
  "§10": {
    lawyer: "No animals or pets of any kind may be kept on the Premises, even temporarily, without Landlord's prior written consent, which Landlord may withhold in its sole discretion. Service and assistance animals are not pets under this Section.",
    plain: "No pets at all, not even for a short visit, unless the landlord agrees in writing, and they can say no for any reason. Service and assistance animals don't count as pets.",
    eli5: "No pets, unless the landlord says yes in writing. They can say no for any reason. Helper animals are allowed.",
  },
  "§11": {
    lawyer: "Tenant may not assign the Lease, sublet any part of the Premises, or list the Premises on any short-term rental platform. Any assignment or sublease without Landlord's prior written consent is void and a material default.",
    plain: "The tenant can't sublet, transfer the lease to someone else, or list the place on short-term rental sites. Trying it without the landlord's written OK doesn't count and is treated as a serious breach of the lease.",
    eli5: "The renter can't let someone else take over the home or rent it out to other people. Doing that breaks a big rule.",
  },
  "§12": same("Covers who keeps the place in shape and how fast repairs happen."),
  "§12.1": {
    lawyer: "Tenant must keep the Premises clean and sanitary, promptly notify Landlord in writing of any leak, mold, or malfunction, and replace smoke detector batteries and light bulbs as needed. Tenant is responsible for repairs caused by the negligence or misuse of Tenant or Tenant's guests.",
    plain: "The tenant keeps the place clean, tells the landlord in writing about leaks, mold, or anything broken, and replaces smoke detector batteries and light bulbs. If the tenant or a guest breaks something through carelessness, the tenant pays to fix it.",
    eli5: "The renter keeps things clean, tells the landlord when something breaks, and changes light bulbs and alarm batteries. If they break something by being careless, they pay to fix it.",
  },
  "§12.2": {
    lawyer: "Landlord must keep the roof, plumbing, heating, and electrical systems in good working order and must begin repairs within 7 days after written notice from Tenant, or within 24 hours for conditions that materially threaten health or safety.",
    plain: "The landlord keeps the roof, plumbing, heat, and electrical working. After the tenant reports a problem in writing, repairs have to start within 7 days, or within 24 hours if it's a health or safety risk.",
    eli5: "The landlord fixes big things like the roof, pipes, heat, and power. They have to start within 7 days, or within 1 day if it's dangerous.",
  },
  "§13": same("Covers when the landlord can come into the home."),
  "§13(a)": {
    lawyer: "Landlord and its agents may enter the Premises at reasonable times to inspect, make necessary repairs, or show the Premises to prospective tenants, purchasers, or lenders, on at least 24 hours' written notice to Tenant.",
    plain: "With at least 24 hours' written notice, the landlord or people working for them can come in at reasonable times to inspect, make repairs, or show the place to future tenants, buyers, or lenders.",
    eli5: "The landlord can come in to check things, fix things, or show the home to people. They have to send a note 24 hours before.",
  },
  "§13(b)": {
    lawyer: "Landlord may enter at any time without notice in an emergency or if Landlord reasonably believes Tenant has abandoned the Premises.",
    plain: "In an emergency, or if the landlord reasonably believes the tenant has moved out for good, the landlord can enter at any time without notice.",
    eli5: "If there's an emergency, like a fire or a flood, the landlord can come in right away without asking. Same if they think the renter left for good.",
  },
  "§13(c)": {
    lawyer: `During the last 30 days of the term, Landlord may post customary "For Rent" signs and show the Premises on 2 hours' notice.`,
    plain: `In the last 30 days of the lease, the landlord can put up "For Rent" signs and show the place with just 2 hours' notice.`,
    eli5: "In the last month, the landlord can put up a sign and bring people to look, with only 2 hours' warning.",
  },
  "§14": {
    lawyer: "Tenant may terminate the Lease before the end of the current term only if Tenant:",
    plain: "The tenant can end the lease early only by doing both of these:",
    eli5: "The renter can leave early only if they do two things:",
  },
  "§14(a)": {
    lawyer: "gives Landlord at least 60 days' prior written notice; and",
    plain: "Give the landlord at least 60 days' written notice.",
    eli5: "Tell the landlord in writing, 60 days ahead.",
  },
  "§14(b)": {
    lawyer: "pays Landlord an early termination fee equal to two months' Rent, plus all Rent due through the termination date.",
    plain: "Pay a fee equal to two months' rent, plus all rent owed up to the move-out date.",
    eli5: "Pay extra money equal to two months of rent, plus the rent they still owe.",
  },
  "§15": {
    lawyer: "If Tenant stays in possession after the Lease ends without Landlord's written consent, Tenant must pay holdover rent of $125.00 per day and is liable for all damages caused by the holdover.",
    plain: "If the tenant stays after the lease ends without the landlord's written OK, it costs $125 a day, plus any costs the late move-out causes the landlord.",
    eli5: "If the renter doesn't leave when the deal is over, they pay $125 for every extra day.",
  },
  "§16": same("Covers insurance and who pays when something goes wrong."),
  "§16.1": {
    lawyer: "Tenant must maintain, at Tenant's expense, renter's insurance with personal liability coverage of at least $100,000 and name Landlord as an additional insured.",
    plain: "The tenant carries renter's insurance with at least $100,000 of liability coverage, pays for it themselves, and lists the landlord on the policy.",
    eli5: "The renter needs to buy insurance, a plan that pays if something goes wrong. The landlord's name goes on it too.",
  },
  "§16.2": {
    lawyer: "Tenant must indemnify, defend, and hold harmless Landlord and its members, managers, agents, and employees from all claims, losses, damages, and expenses, including reasonable attorneys' fees, arising from the use of the Premises by Tenant or Tenant's guests, except to the extent caused by Landlord's gross negligence or willful misconduct.",
    plain: "If anyone makes a claim tied to how the tenant or their guests use the place, the tenant pays the landlord's costs, including lawyers. The only exception is harm caused by the landlord's gross negligence or deliberate wrongdoing.",
    eli5: "If someone gets hurt or something goes wrong because of the renter or their friends, the renter pays, even the landlord's lawyer bills.",
  },
  "§16.3": {
    lawyer: "Landlord is not liable to Tenant or Tenant's guests for loss of or damage to personal property, or for bodily injury, resulting from theft, fire, water, mold, or the acts or omissions of other residents, regardless of cause.",
    plain: "The landlord isn't responsible if the tenant's or guests' belongings are stolen or damaged, or if someone is hurt, because of theft, fire, water, mold, or other residents, whatever the cause.",
    eli5: "If the renter's stuff gets stolen or ruined, or someone gets hurt, the landlord doesn't have to pay. That's why renter's insurance matters.",
  },
  "§17": same("Covers how disagreements get settled."),
  "§17(a)": {
    lawyer: "Any dispute arising out of or relating to the Lease will be resolved exclusively by final, binding arbitration before a single arbitrator selected by Landlord, and not in court.",
    plain: "Any disagreement about the lease goes to private arbitration instead of court. The landlord picks the arbitrator, and the decision is final.",
    eli5: "If the renter and landlord fight about the deal, a private referee decides instead of a judge. The landlord picks the referee.",
  },
  "§17(b)": {
    lawyer: "Tenant may bring claims only in Tenant's individual capacity, and not as a plaintiff or class member in any class, collective, or representative proceeding.",
    plain: "The tenant can only bring claims alone. Joining a class action or group case with other tenants isn't allowed.",
    eli5: "The renter has to complain alone. They can't team up with other renters.",
  },
  "§17(c)": {
    lawyer: "Each Party knowingly and voluntarily waives any right to a jury trial.",
    plain: "Both sides give up the right to a jury trial.",
    eli5: "If it ever goes to court, there's no jury.",
  },
  "§18": {
    lawyer: "In any action to enforce or interpret the Lease, the prevailing Party may recover its reasonable attorneys' fees and costs.",
    plain: "If there's a legal fight over the lease, whoever wins can make the other side pay their lawyer fees and costs.",
    eli5: "If they go to court, the loser pays the winner's lawyer bills too.",
  },
  "§19": {
    lawyer: "Tenant must comply with the Community Rules in Addendum A. Landlord may amend the Community Rules at any time by posting notice in the common areas or notifying Tenant, and amendments bind Tenant as if set out in this Lease.",
    plain: "The tenant has to follow the community rules in Addendum A. The landlord can change those rules at any time just by posting a notice, and the new rules count as part of the lease.",
    eli5: "The renter follows the building rules. The landlord can change the rules whenever they want, and the renter still has to follow them.",
  },
  "§20": same("Covers notices, which state's law applies, and the rest of the fine print."),
  "§20.1": {
    lawyer: "All notices under the Lease must be in writing and delivered by hand, first-class mail, or email to the addresses listed below the Parties' signatures.",
    plain: "Official notices have to be in writing, delivered in person, by mail, or by email to the addresses under the signatures.",
    eli5: "Important messages have to be written down and sent by mail, email, or by hand.",
  },
  "§20.2": {
    lawyer: "California law governs the Lease. Any action not subject to arbitration must be brought only in the state courts in Marisco County, California.",
    plain: "California law applies. Any case that doesn't go to arbitration has to be filed in Marisco County state court.",
    eli5: "California's rules apply. If they go to court, it's the court in Marisco County.",
  },
  "§20.3": {
    lawyer: "The Lease, including Addendum A, is the entire agreement between the Parties and may be amended only by a writing signed by both Parties. If any provision is held invalid or unenforceable, the rest remains in effect.",
    plain: "This lease and Addendum A are the whole deal. Spoken promises don't count, and changes have to be in writing and signed by both sides. If a court strikes one part, the rest still applies.",
    eli5: "Everything in the deal is written here. Changing it needs both people to sign. If one part gets thrown out, the rest still counts.",
  },
  Signatures: {
    lawyer: "Signed by the Parties as of the date first written above: Bramblecote Properties LLC (Landlord), by Odile Brannigan, Managing Member; and Marlowe Quintero (Tenant).",
    plain: "Odile Brannigan signs for Bramblecote Properties LLC (the landlord), and Marlowe Quintero signs as the tenant.",
    eli5: "Both sides sign here to say yes to the deal.",
  },
  "Add. A": same("The community rules that come with the lease. The landlord can change these at any time (see §19)."),
  "Add. A(1)": {
    lawyer: "Quiet hours are 10:00 p.m. to 7:00 a.m. daily.",
    plain: "Keep it quiet from 10 p.m. to 7 a.m. every day.",
    eli5: "Be quiet at night, from 10 p.m. to 7 a.m.",
  },
  "Add. A(2)": {
    lawyer: "Grills, smokers, and open flames are prohibited on balconies and patios.",
    plain: "No grills, smokers, or open flames on balconies or patios.",
    eli5: "No cooking fires outside on the balcony.",
  },
  "Add. A(3)": {
    lawyer: "Bicycles may be stored only in the designated bike room; any bicycle left in a common area may be removed at Tenant's expense.",
    plain: "Bikes go in the bike room only. A bike left in a shared area can be removed, and the tenant pays for the removal.",
    eli5: "Bikes go in the bike room. If one is left in the hall, it can be taken away, and the renter pays for that.",
  },
};

/** Only the clauses whose text differs in v2; everything else reuses v1. */
export const LEASE_V2_CHANGES: Record<string, FixtureRewrite> = {
  "§3": renewal(60),
  "§4.1": rent("1,925"),
  "§4.4": {
    lawyer: "Tenant must pay a monthly amenity fee of $40.00 for access to the fitness room and package lockers, payable with Rent. The fee is non-refundable and applies whether or not Tenant uses the amenities.",
    plain: "There's a $40 monthly amenity fee for the gym and package lockers, paid with rent. The tenant pays it even without using them, and it's never refunded.",
    eli5: "The renter pays $40 more each month for the gym and package boxes, even if they never use them.",
  },
  "§10": {
    lawyer: "Tenant may keep one domestic cat or dog weighing no more than 25 pounds, subject to Landlord's prior written approval of the specific animal. Tenant must pay a refundable pet deposit of $500.00 on approval and monthly pet rent of $45.00, payable with Rent, and is responsible for all damage the animal causes. Service and assistance animals are not pets under this Section.",
    plain: "The tenant can have one cat or dog up to 25 pounds, if the landlord approves that specific animal in writing. It costs a $500 refundable pet deposit plus $45 a month in pet rent, and the tenant pays for any damage the pet causes. Service and assistance animals don't count as pets.",
    eli5: "The renter can have one small cat or dog, if the landlord says yes. It costs $500 to start (they can get it back) and $45 more each month. If the pet breaks something, the renter pays.",
  },
};

export const SAMPLE_FIXTURES: Record<string, Record<string, FixtureRewrite>> = {
  "lease-v1": LEASE_V1,
  "lease-v2": { ...LEASE_V1, ...LEASE_V2_CHANGES },
};
