import Firebase from './firebase'
import User from './user'
import Auth from './auth'
import { Observable } from 'rxjs'

import flow from 'lodash/fp/flow'
import filter from 'lodash/fp/filter'
import map from 'lodash/fp/map'
import values from 'lodash/fp/values'
import identity from 'lodash/fp/identity'
import keys from 'lodash/fp/keys'
import flatMap from 'lodash/fp/flatMap'
import countBy from 'lodash/fp/countBy'
import toPairs from 'lodash/fp/toPairs'

export default {
  list () {
    const ref = Firebase.ref('course').orderByChild('open').equalTo(true)
    return Firebase.onArrayValue(ref)
  },
  get (id) {
    return Firebase.onValue(`course/${id}`)
      .map((course) => ({id, ...course}))
  },
  create (data) {
    data.timestamp = Firebase.timestamp
    return Firebase.push('course', data)
      .map((snapshot) => snapshot.key)
  },
  save (id, data) {
    return Firebase.update(`course/${id}`, data)
  },
  favorite (id) {
    return Auth.currentUser()
      .first()
      .flatMap((user) => Firebase.set(`course/${id}/favorite/${user.uid}`, true))
  },
  unfavorite (id) {
    return Auth.currentUser()
      .first()
      .flatMap((user) => Firebase.remove(`course/${id}/favorite/${user.uid}`))
  },
  join (id) {
    return Auth.currentUser()
      .first()
      .flatMap((user) =>
        Observable.forkJoin(
          Firebase.set(`course/${id}/student/${user.uid}`, true),
          User.addCourseMe(id)
        )
      )
  },
  ownBy (userId) {
    const ref = Firebase.ref('course').orderByChild('owner').equalTo(userId)
    return Observable.combineLatest(
      Auth.currentUser().first(),
      Firebase.onArrayValue(ref)
    )
      .map(([auth, courses]) => auth.uid === userId ? courses : filter((course) => course.open)(courses))
  },
  sendMessage (id, text) {
    return Auth.currentUser()
      .first()
      .flatMap((auth) => Firebase.push(`chat/${id}`, {
        u: auth.uid,
        m: text,
        t: Firebase.timestamp
      }))
  },
  messages (id, limit) {
    let ref = Firebase.ref(`chat/${id}`).orderByKey()
    if (limit) {
      ref = ref.limitToLast(limit)
    }
    return Firebase.onChildAdded(ref)
  },
  attend (id, code) {
    return Auth.currentUser()
      .first()
      .flatMap((auth) => Firebase.set(`attend/${id}/${code}/${auth.uid}`, Firebase.timestamp))
  },
  setAttendCode (id, code) {
    return Firebase.set(`course/${id}/attend`, code)
  },
  removeAttendCode (id) {
    return Firebase.set(`course/${id}/attend`, null)
  },
  attendUsers (id) {
    return Firebase.onValue(`attend/${id}`)
      .map(
        flow(
          values,
          flatMap(keys),
          countBy(identity),
          toPairs,
          map((x) => ({ id: x[0], count: x[1] }))
        )
      )
      .flatMap((users) => Observable.from(users)
        .concatMap((user) => User.getOnce(user.id), (user, result) => ({ ...user, ...result }))
        .toArray())
  },
  isAttended (id) {
    return Observable.forkJoin(
      Auth.currentUser().first(),
      this.get(id).first().map((course) => course.attend)
    )
      .flatMap(([auth, code]) => Firebase.onValue(`attend/${id}/${code}/${auth.uid}`))
      .map((x) => !!x)
  },
  addAssignment (id, { title }) {
    return Firebase.push(`assignment/${id}/code`, { title, open: true })
  },
  getAssignments (id) {
    return Firebase.onArrayValue(`assignment/${id}/code`)
  },
  getAssignmentUser (id) {
    return Auth.currentUser()
      .first()
      .flatMap((auth) => Firebase.onValue(`assignment/${id}/user/${auth.uid}`))
  },
  addAssignmentFile (id, assignmentId, url) {
    return Auth.currentUser()
      .first()
      .flatMap((auth) => Firebase.push(`assignment/${id}/user/${auth.uid}/${assignmentId}`, {
        url,
        timestamp: Firebase.timestamp
      }))
  }
}
