# Pickleball Poacher

City of Ottawa recreation centre drop-in reservation script.

## Why

The City of Ottawa opens registration for drop-in events 2 days in advance at 6 PM. It can be hard to remember to sign up at that time and the site also suffers from traffic at that time making it slow. If you intend to sign up for multiple people or multiple slots, it can be a delecate balancing act. On top of that, if you try to fill out the form multiple times without refreshing the browser page, _it can fail silently, informing you that your reservation was successful when it wasn't._

## How

The goal is to enumerate the slots you'd like to reserve, and then run the script on a schedule where it will wake up once a day at 6 PM and fulfill any outstanding reservations. It should be able to do these in tandem and will retry if the site's connection is spotty. It won't stop until it finds a spot, so if the day fills up it will retry over time.

It will need n sets of email + phone, which would match up to how many slots you want to reserve \* the number of people you want to reserve for, divided by two. E.g. if you want to schedule for 2 people for 3 sessions at once, that is 3 identities. If you want to register for 6 people, 2 sessions at once, t'at is 6 identities.
