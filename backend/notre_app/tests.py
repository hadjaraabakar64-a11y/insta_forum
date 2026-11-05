from io import BytesIO
import json

from django.contrib.auth.models import User
from django.core import signing
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image

from .models import (
    AccordReponse, CaptureQuestion, Commentaire, FavoriQuestion, MatriculeEtudiant, ProfilUtilisateur,
    Question, Reponse, Tag, categorie, notification, vue,
)


class QuestionCaptureEcranTests(TestCase):
    def setUp(self):
        self.auteur = User.objects.create_user(username='alice', password='test')
        self.categorie = categorie.objects.create(nom='Informatique')

    def test_capture_ecran_est_facultative(self):
        question = Question.objects.create(
            titre='Question sans image',
            contenu='Contenu de la question',
            auteur=self.auteur,
            categorie=self.categorie,
        )

        self.assertFalse(question.capture_ecran)

    def test_capture_ecran_peut_etre_televersee(self):
        image_buffer = BytesIO()
        Image.new('RGB', (1, 1)).save(image_buffer, format='PNG')
        image = SimpleUploadedFile(
            'capture.png',
            image_buffer.getvalue(),
            content_type='image/png',
        )

        question = Question.objects.create(
            titre='Question avec image',
            contenu='Contenu de la question',
            auteur=self.auteur,
            categorie=self.categorie,
            capture_ecran=image,
        )
        self.addCleanup(question.capture_ecran.delete, save=False)

        self.assertTrue(question.capture_ecran.name.startswith('questions/'))
        self.assertTrue(question.capture_ecran.storage.exists(question.capture_ecran.name))


class QuestionCapturesApiTests(TestCase):
    def setUp(self):
        self.auteur = User.objects.create_user(username='alice', password='test')
        self.autre = User.objects.create_user(username='bob', password='test')
        self.categorie = categorie.objects.create(nom='Informatique')
        self.question = Question.objects.create(
            titre='Question avec image',
            contenu='Contenu de la question',
            auteur=self.auteur,
            categorie=self.categorie,
        )
        self.token = signing.dumps(self.auteur.pk, salt='notre_app.api-token')
        self.autre_token = signing.dumps(self.autre.pk, salt='notre_app.api-token')

    def creer_image(self, nom='capture.png'):
        buffer = BytesIO()
        Image.new('RGB', (1, 1)).save(buffer, format='PNG')
        return SimpleUploadedFile(nom, buffer.getvalue(), content_type='image/png')

    def test_capture_televersee_est_visible_sur_la_question_a_repondre(self):
        response = self.client.post(
            f'/api/questions/{self.question.id}/captures/',
            {'images': [self.creer_image()]},
            HTTP_AUTHORIZATION=f'Token {self.token}',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.json()), 1)
        capture = response.json()[0]
        capture_enregistree = CaptureQuestion.objects.get(pk=capture['id'])
        self.assertTrue(capture_enregistree.image.storage.exists(capture_enregistree.image.name))
        self.addCleanup(
            lambda: capture_enregistree.image.delete(save=False)
        )
        self.assertTrue(capture['image'].startswith('/media/questions/'))

        detail = self.client.get(f'/api/questions/{self.question.id}/')

        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()['captures'][0]['id'], capture['id'])
        self.assertEqual(detail.json()['captures'][0]['image'], capture['image'])

    def test_seul_auteur_peut_ajouter_ou_supprimer_une_capture(self):
        interdit = self.client.post(
            f'/api/questions/{self.question.id}/captures/',
            {'images': [self.creer_image()]},
            HTTP_AUTHORIZATION=f'Token {self.autre_token}',
        )
        self.assertEqual(interdit.status_code, 403)

        ajout = self.client.post(
            f'/api/questions/{self.question.id}/captures/',
            {'images': [self.creer_image()]},
            HTTP_AUTHORIZATION=f'Token {self.token}',
        )
        self.assertEqual(ajout.status_code, 201)
        capture = ajout.json()[0]
        self.addCleanup(
            lambda: CaptureQuestion.objects.filter(pk=capture['id']).first()
            and CaptureQuestion.objects.get(pk=capture['id']).image.delete(save=False)
        )
        suppression_interdite = self.client.delete(
            f"/api/captures/{capture['id']}/",
            HTTP_AUTHORIZATION=f'Token {self.autre_token}',
        )
        suppression = self.client.delete(
            f"/api/captures/{capture['id']}/",
            HTTP_AUTHORIZATION=f'Token {self.token}',
        )

        self.assertEqual(suppression_interdite.status_code, 403)
        self.assertEqual(suppression.status_code, 200)
        self.assertFalse(CaptureQuestion.objects.filter(pk=capture['id']).exists())


class AccueilTests(TestCase):
    def test_accueil_affiche_le_contenu_cree_dans_l_admin(self):
        auteur = User.objects.create_user(username='alice', password='test')
        categorie_question = categorie.objects.create(nom='Informatique')
        tag = Tag.objects.create(nom='Django')
        image_buffer = BytesIO()
        Image.new('RGB', (1, 1)).save(image_buffer, format='PNG')
        image = SimpleUploadedFile(
            'capture-accueil.png',
            image_buffer.getvalue(),
            content_type='image/png',
        )
        question = Question.objects.create(
            titre='Comment afficher une image ?',
            contenu='Ma question publiée depuis l’administration.',
            extrait_code='print("bonjour")',
            auteur=auteur,
            categorie=categorie_question,
            capture_ecran=image,
        )
        self.addCleanup(question.capture_ecran.delete, save=False)
        question.tags.add(tag)
        reponse = Reponse.objects.create(
            question=question,
            auteur=auteur,
            contenu='Voici une réponse.',
        )
        Commentaire.objects.create(
            reponse=reponse,
            auteur=auteur,
            contenu='Merci pour cette précision.',
        )

        response = self.client.get('/')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, question.titre)
        self.assertContains(response, question.contenu)
        self.assertContains(response, 'print(&quot;bonjour&quot;)')
        self.assertContains(response, question.capture_ecran.url)
        self.assertContains(response, categorie_question.nom)
        self.assertContains(response, tag.nom)
        self.assertContains(response, reponse.contenu)
        self.assertContains(response, 'Merci pour cette précision.')
        self.assertContains(response, '<strong>1</strong> question')
        self.assertContains(response, '<strong>1</strong> réponse')
        self.assertContains(response, '<strong>1</strong> commentaire')


class ApiConnexionTests(TestCase):
    def setUp(self):
        self.categorie = categorie.objects.create(nom='Informatique')

    def post_json(self, url, data, **extra):
        return self.client.post(
            url,
            data=json.dumps(data),
            content_type='application/json',
            **extra,
        )

    def test_inscription_connexion_et_compte_courant(self):
        matricule = MatriculeEtudiant.objects.create(numero='ETU-001')
        inscription = self.post_json('/api/comptes/inscription/', {
            'username': 'alice',
            'email': 'alice@example.com',
            'password': 'motdepasse-securise',
            'prenom': 'Alice',
            'nom': 'Martin',
            'profil': 'etudiant',
            'niveau': 'L2',
            'matricule': 'ETU-001',
        })
        self.assertEqual(inscription.status_code, 201)
        self.assertEqual(inscription.json()['utilisateur']['prenom'], 'Alice')
        self.assertEqual(inscription.json()['utilisateur']['matricule'], 'ETU-001')
        self.assertEqual(inscription.json()['utilisateur']['profil'], 'etudiant')
        self.assertEqual(inscription.json()['utilisateur']['niveau'], 'L2')
        matricule.refresh_from_db()
        self.assertEqual(matricule.utilisateur.username, 'alice')

        connexion = self.post_json('/api/comptes/connexion/', {
            'identifier': 'alice@example.com',
            'password': 'motdepasse-securise',
        })
        self.assertEqual(connexion.status_code, 200)
        token = connexion.json()['token']

        compte = self.client.get('/api/comptes/moi/', HTTP_AUTHORIZATION=f'Token {token}')
        self.assertEqual(compte.status_code, 200)
        self.assertEqual(compte.json()['username'], 'alice')
        self.assertEqual(compte.json()['niveau'], 'L2')

        modification = self.client.patch(
            '/api/comptes/moi/',
            data=json.dumps({
                'prenom': 'Alicia',
                'nom': 'Martin',
                'profil': 'enseignant',
                'niveau': '',
            }),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Token {token}',
        )
        self.assertEqual(modification.status_code, 405)
        compte_apres_refus = self.client.get(
            '/api/comptes/moi/',
            HTTP_AUTHORIZATION=f'Token {token}',
        )
        self.assertEqual(compte_apres_refus.json()['prenom'], 'Alice')
        self.assertEqual(compte_apres_refus.json()['profil'], 'etudiant')
        self.assertEqual(compte_apres_refus.json()['niveau'], 'L2')

    def test_un_enseignant_peut_se_connecter_avec_son_email(self):
        enseignant = User.objects.create_user(
            username='enseignant',
            email='enseignant@example.com',
            password='motdepasse-securise',
        )
        ProfilUtilisateur.objects.create(
            utilisateur=enseignant,
            profil='enseignant',
        )

        connexion = self.post_json('/api/comptes/connexion/', {
            'identifier': 'enseignant@example.com',
            'password': 'motdepasse-securise',
        })

        self.assertEqual(connexion.status_code, 200)
        self.assertEqual(connexion.json()['utilisateur']['username'], 'enseignant')
        self.assertEqual(connexion.json()['utilisateur']['profil'], 'enseignant')
        self.assertEqual(connexion.json()['utilisateur']['grade'], '')

    def test_inscription_refuse_un_niveau_manquant(self):
        MatriculeEtudiant.objects.create(numero='ETU-SANS-NIVEAU')
        inscription = self.post_json('/api/comptes/inscription/', {
            'username': 'sansniveau',
            'email': 'sansniveau@example.com',
            'password': 'motdepasse-securise',
            'prenom': 'Sans',
            'nom': 'Niveau',
            'profil': 'etudiant',
            'matricule': 'ETU-SANS-NIVEAU',
        })

        self.assertEqual(inscription.status_code, 400)
        self.assertIn('niveau', inscription.json())
        self.assertFalse(User.objects.filter(username='sansniveau').exists())

    def test_profil_public_renvoie_le_niveau_enregistre(self):
        auteur = User.objects.create_user(username='ali', password='motdepasse-securise')
        lecteur = User.objects.create_user(username='lecteur', password='motdepasse-securise')
        ProfilUtilisateur.objects.create(
            utilisateur=auteur,
            profil='etudiant',
            niveau='L2',
        )
        token = signing.dumps(lecteur.pk, salt='notre_app.api-token')

        profil = self.client.get(
            '/api/membres/ALI/',
            HTTP_AUTHORIZATION=f'Token {token}',
        )

        self.assertEqual(profil.status_code, 200)
        self.assertEqual(profil.json()['niveau'], 'L2')

    def test_utilisateur_peut_modifier_uniquement_son_niveau(self):
        user = User.objects.create_user(
            username='niveautest',
            email='niveau@example.com',
            password='motdepasse-securise',
        )
        token = signing.dumps(user.pk, salt='notre_app.api-token')

        modification = self.post_json(
            '/api/comptes/moi/niveau/',
            {'niveau': 'M1'},
            HTTP_AUTHORIZATION=f'Token {token}',
        )

        self.assertEqual(modification.status_code, 200)
        self.assertEqual(modification.json()['niveau'], 'M1')
        self.assertEqual(user.profil_utilisateur.profil, 'etudiant')

    def test_modification_niveau_refuse_valeur_invalide_ou_utilisateur_anonyme(self):
        user = User.objects.create_user(username='niveau', password='motdepasse')
        token = signing.dumps(user.pk, salt='notre_app.api-token')

        invalide = self.post_json(
            '/api/comptes/moi/niveau/',
            {'niveau': 'D7'},
            HTTP_AUTHORIZATION=f'Token {token}',
        )
        anonyme = self.post_json('/api/comptes/moi/niveau/', {'niveau': 'L1'})

        self.assertEqual(invalide.status_code, 400)
        self.assertEqual(anonyme.status_code, 401)

    def test_administrateur_est_identifie_et_ne_peut_pas_modifier_un_niveau(self):
        administrateur = User.objects.create_user(
            username='administrateur',
            password='motdepasse-securise',
            is_staff=True,
        )
        ProfilUtilisateur.objects.create(
            utilisateur=administrateur,
            profil='etudiant',
            niveau='L2',
        )
        token = signing.dumps(administrateur.pk, salt='notre_app.api-token')

        compte = self.client.get(
            '/api/comptes/moi/',
            HTTP_AUTHORIZATION=f'Token {token}',
        )
        modification = self.post_json(
            '/api/comptes/moi/niveau/',
            {'niveau': 'M1'},
            HTTP_AUTHORIZATION=f'Token {token}',
        )

        self.assertEqual(compte.status_code, 200)
        self.assertEqual(compte.json()['profil'], 'administrateur')
        self.assertTrue(compte.json()['is_staff'])
        self.assertEqual(compte.json()['niveau'], '')
        self.assertEqual(modification.status_code, 403)
        administrateur.profil_utilisateur.refresh_from_db()
        self.assertEqual(administrateur.profil_utilisateur.niveau, 'L2')

    def test_enseignant_peut_modifier_son_grade(self):
        enseignant = User.objects.create_user(
            username='enseignant',
            password='motdepasse-securise',
        )
        ProfilUtilisateur.objects.create(
            utilisateur=enseignant,
            profil='enseignant',
        )
        token = signing.dumps(enseignant.pk, salt='notre_app.api-token')

        modification = self.post_json(
            '/api/comptes/moi/grade/',
            {'grade': 'maitre_assistant'},
            HTTP_AUTHORIZATION=f'Token {token}',
        )

        self.assertEqual(modification.status_code, 200)
        self.assertEqual(modification.json()['grade'], 'maitre_assistant')
        self.assertEqual(modification.json()['profil'], 'enseignant')
        enseignant.profil_utilisateur.refresh_from_db()
        self.assertEqual(enseignant.profil_utilisateur.grade, 'maitre_assistant')
        self.assertEqual(enseignant.first_name, '')
        self.assertEqual(enseignant.last_name, '')

    def test_modification_grade_refuse_valeur_invalide_ou_non_enseignant(self):
        enseignant = User.objects.create_user(username='enseignant-grade', password='motdepasse')
        ProfilUtilisateur.objects.create(utilisateur=enseignant, profil='enseignant')
        etudiant = User.objects.create_user(username='etudiant-grade', password='motdepasse')
        token_enseignant = signing.dumps(enseignant.pk, salt='notre_app.api-token')
        token_etudiant = signing.dumps(etudiant.pk, salt='notre_app.api-token')

        invalide = self.post_json(
            '/api/comptes/moi/grade/',
            {'grade': 'grade-inconnu'},
            HTTP_AUTHORIZATION=f'Token {token_enseignant}',
        )
        interdit = self.post_json(
            '/api/comptes/moi/grade/',
            {'grade': 'assistant'},
            HTTP_AUTHORIZATION=f'Token {token_etudiant}',
        )
        anonyme = self.post_json('/api/comptes/moi/grade/', {'grade': 'assistant'})

        self.assertEqual(invalide.status_code, 400)
        self.assertIn('grade', invalide.json())
        self.assertEqual(interdit.status_code, 403)
        self.assertEqual(anonyme.status_code, 401)

    def test_administrateur_peut_modifier_son_propre_nom(self):
        administrateur = User.objects.create_user(
            username='administrateur',
            first_name='Admin',
            last_name='Initial',
            password='motdepasse-securise',
            is_superuser=True,
            is_staff=True,
        )
        token = signing.dumps(administrateur.pk, salt='notre_app.api-token')

        modification = self.post_json(
            '/api/comptes/moi/nom-administrateur/',
            {'prenom': 'Nouveau', 'nom': 'Nom'},
            HTTP_AUTHORIZATION=f'Token {token}',
        )

        self.assertEqual(modification.status_code, 200)
        self.assertEqual(modification.json()['prenom'], 'Nouveau')
        self.assertEqual(modification.json()['nom'], 'Nom')
        administrateur.refresh_from_db()
        self.assertEqual(administrateur.first_name, 'Nouveau')
        self.assertEqual(administrateur.last_name, 'Nom')

    def test_utilisateur_non_administrateur_ne_peut_pas_modifier_son_nom_via_endpoint_admin(self):
        utilisateur = User.objects.create_user(
            username='utilisateur',
            first_name='Prenom',
            last_name='Nom',
            password='motdepasse-securise',
        )
        token = signing.dumps(utilisateur.pk, salt='notre_app.api-token')

        modification = self.post_json(
            '/api/comptes/moi/nom-administrateur/',
            {'prenom': 'Autre', 'nom': 'Nom'},
            HTTP_AUTHORIZATION=f'Token {token}',
        )

        self.assertEqual(modification.status_code, 403)
        utilisateur.refresh_from_db()
        self.assertEqual(utilisateur.first_name, 'Prenom')
        self.assertEqual(utilisateur.last_name, 'Nom')

    def test_utilisateur_peut_changer_son_mot_de_passe_avec_son_mot_de_passe_actuel(self):
        user = User.objects.create_user(
            username='mdptest',
            email='mdp@example.com',
            password='motdepasse-actuel',
        )
        token = signing.dumps(user.pk, salt='notre_app.api-token')

        changement = self.post_json(
            '/api/comptes/mot-de-passe/',
            {
                'ancien': 'motdepasse-actuel',
                'nouveau': 'Nouveau-mot-de-passe-2026!',
            },
            HTTP_AUTHORIZATION=f'Token {token}',
        )

        self.assertEqual(changement.status_code, 200)
        self.assertTrue(user.__class__.objects.get(pk=user.pk).check_password(
            'Nouveau-mot-de-passe-2026!',
        ))
        self.assertTrue(changement.json()['token'])

    def test_changement_mot_de_passe_refuse_un_ancien_mot_de_passe_incorrect(self):
        user = User.objects.create_user(username='mdptest', password='motdepasse-actuel')
        token = signing.dumps(user.pk, salt='notre_app.api-token')

        changement = self.post_json(
            '/api/comptes/mot-de-passe/',
            {'ancien': 'incorrect', 'nouveau': 'Nouveau-mot-de-passe-2026!'},
            HTTP_AUTHORIZATION=f'Token {token}',
        )

        self.assertEqual(changement.status_code, 400)
        self.assertTrue(user.check_password('motdepasse-actuel'))


    def test_inscription_etudiant_refuse_un_matricule_absent_ou_deja_utilise(self):
        donnees = {
            'username': 'alice',
            'email': 'alice@example.com',
            'password': 'motdepasse-securise',
            'prenom': 'Alice',
            'nom': 'Martin',
            'profil': 'etudiant',
            'niveau': 'L1',
            'matricule': 'ETU-999',
        }

        absent = self.post_json('/api/comptes/inscription/', donnees)
        self.assertEqual(absent.status_code, 400)
        self.assertIn('matricule', absent.json())
        self.assertFalse(User.objects.filter(username='alice').exists())

        inscrit = User.objects.create_user(username='bob', password='motdepasse')
        MatriculeEtudiant.objects.create(numero='ETU-999', utilisateur=inscrit)
        deja_utilise = self.post_json('/api/comptes/inscription/', donnees)
        self.assertEqual(deja_utilise.status_code, 400)
        self.assertIn('matricule', deja_utilise.json())
        self.assertFalse(User.objects.filter(username='alice').exists())

    def test_inscription_refuse_les_profils_enseignant_et_personnel(self):
        for profil in ('enseignant', 'personnel'):
            inscription = self.post_json('/api/comptes/inscription/', {
                'username': profil,
                'email': f'{profil}@example.com',
                'password': 'motdepasse-securise',
                'prenom': 'Compte',
                'nom': 'Test',
                'profil': profil,
            })

            self.assertEqual(inscription.status_code, 400)
            self.assertIn('profil', inscription.json())
            self.assertFalse(User.objects.filter(username=profil).exists())
        self.assertFalse(MatriculeEtudiant.objects.exists())

    def test_questions_categories_et_statistiques_sont_disponibles(self):
        auteur = User.objects.create_user(username='alice', password='motdepasse')
        question = Question.objects.create(
            titre='Question de test',
            contenu='Description de test',
            auteur=auteur,
            categorie=self.categorie,
        )

        liste = self.client.get('/api/questions/')
        self.assertEqual(liste.status_code, 200)
        self.assertEqual(liste.json()[0]['titre'], question.titre)
        self.assertEqual(liste.json()[0]['description'], question.contenu)

        detail = self.client.get(f'/api/questions/{question.id}/')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()['categorie']['nom'], self.categorie.nom)

        categories = self.client.get('/api/categories/')
        self.assertEqual(categories.status_code, 200)
        self.assertEqual(categories.json()[0]['id'], self.categorie.id)

        statistiques = self.client.get('/api/statistiques/')
        self.assertEqual(statistiques.status_code, 200)
        self.assertEqual(statistiques.json()['questions'], 1)

    def test_liste_des_questions_ne_compte_qu_une_vue_par_utilisateur(self):
        auteur = User.objects.create_user(username='alice', password='motdepasse')
        lecteur = User.objects.create_user(username='bob', password='motdepasse')
        question = Question.objects.create(
            titre='Question affichée dans la liste',
            contenu='Description.',
            auteur=auteur,
            categorie=self.categorie,
        )
        token = signing.dumps(lecteur.pk, salt='notre_app.api-token')

        response = self.client.get(
            '/api/questions/',
            HTTP_AUTHORIZATION=f'Token {token}',
        )
        seconde_lecture = self.client.get(
            '/api/questions/',
            HTTP_AUTHORIZATION=f'Token {token}',
        )
        consultation_detail = self.client.get(
            f'/api/questions/{question.id}/',
            HTTP_AUTHORIZATION=f'Token {token}',
        )
        retour_liste = self.client.get(
            '/api/questions/',
            HTTP_AUTHORIZATION=f'Token {token}',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]['vues'], 1)
        self.assertEqual(seconde_lecture.json()[0]['vues'], 1)
        self.assertEqual(consultation_detail.json()['vues'], 1)
        self.assertEqual(retour_liste.json()[0]['vues'], 1)
        self.assertEqual(vue.objects.filter(question=question, utilisateur=lecteur).count(), 1)

    def test_publication_question_requiert_un_compte_connecte(self):
        refus = self.post_json('/api/questions/', {
            'titre': 'Nouvelle question',
            'categorie_id': self.categorie.id,
            'description': 'Description.',
        })
        self.assertEqual(refus.status_code, 401)

        auteur = User.objects.create_user(username='alice', password='motdepasse')
        token = signing.dumps(auteur.pk, salt='notre_app.api-token')
        response = self.post_json(
            '/api/questions/',
            {
                'titre': 'Nouvelle question',
                'categorie_id': self.categorie.id,
                'description': 'Description.',
                'tags': ['django'],
            },
            HTTP_AUTHORIZATION=f'Token {token}',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['tags'], ['django'])

    def test_ouverture_question_enregistre_et_retourne_les_vues(self):
        auteur = User.objects.create_user(username='alice', password='motdepasse')
        lecteur = User.objects.create_user(username='bob', password='motdepasse')
        question = Question.objects.create(
            titre='Question consultée',
            contenu='Description.',
            auteur=auteur,
            categorie=self.categorie,
        )
        token = signing.dumps(lecteur.pk, salt='notre_app.api-token')
        entetes = {'HTTP_AUTHORIZATION': f'Token {token}'}

        premiere_lecture = self.client.get(f'/api/questions/{question.id}/', **entetes)
        self.assertEqual(premiere_lecture.status_code, 200)
        self.assertEqual(premiere_lecture.json()['vues'], 1)
        self.assertEqual(vue.objects.filter(question=question, utilisateur=lecteur).count(), 1)

        seconde_lecture = self.client.get(f'/api/questions/{question.id}/', **entetes)
        self.assertEqual(seconde_lecture.json()['vues'], 1)
        self.assertEqual(vue.objects.filter(question=question, utilisateur=lecteur).count(), 1)

        autre_lecteur = User.objects.create_user(username='charlie', password='motdepasse')
        autre_token = signing.dumps(autre_lecteur.pk, salt='notre_app.api-token')
        troisieme_lecture = self.client.get(
            f'/api/questions/{question.id}/',
            HTTP_AUTHORIZATION=f'Token {autre_token}',
        )
        self.assertEqual(troisieme_lecture.json()['vues'], 2)
        self.assertEqual(vue.objects.filter(question=question).count(), 2)

        liste = self.client.get(
            '/api/questions/',
            HTTP_AUTHORIZATION=f'Token {autre_token}',
        )
        self.assertEqual(liste.json()[0]['vues'], 2)


class ProfilUtilisateurApiTests(TestCase):
    def setUp(self):
        self.utilisateur = User.objects.create_user(
            username='alice',
            email='alice@example.com',
            first_name='Alice',
            last_name='Martin',
            password='motdepasse',
        )
        self.autre_utilisateur = User.objects.create_user(
            username='bob',
            password='motdepasse',
        )
        self.categorie = categorie.objects.create(nom='Informatique')
        self.question = Question.objects.create(
            titre='Ma question',
            contenu='Contenu',
            auteur=self.utilisateur,
            categorie=self.categorie,
        )
        self.reponse = Reponse.objects.create(
            question=self.question,
            auteur=self.utilisateur,
            contenu='Une réponse utile',
            acceptee=True,
        )
        AccordReponse.objects.create(
            reponse=self.reponse,
            utilisateur=self.autre_utilisateur,
        )
        self.token = signing.dumps(self.utilisateur.pk, salt='notre_app.api-token')

    def test_profil_public_retourne_les_informations_et_statistiques(self):
        ProfilUtilisateur.objects.create(
            utilisateur=self.utilisateur,
            profil='etudiant',
            niveau='M1',
        )
        response = self.client.get(
            '/api/membres/alice/',
            HTTP_AUTHORIZATION=f'Token {self.token}',
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['email'], 'alice@example.com')
        self.assertEqual(data['niveau'], 'M1')
        self.assertEqual(len(data['questions']), 1)
        self.assertEqual(data['questions'][0]['titre'], 'Ma question')
        self.assertEqual(data['reponses'][0]['extrait'], 'Une réponse utile')
        self.assertEqual(data['stats']['questions'], 1)
        self.assertEqual(data['stats']['reponses'], 1)
        self.assertEqual(data['stats']['acceptees'], 1)
        self.assertEqual(data['stats']['votes_recus'], 1)
        self.assertEqual(data['stats']['points'], 9)
        self.assertEqual(data['stats']['rang'], 1)

    def test_profil_public_retourne_le_grade_enseignant(self):
        ProfilUtilisateur.objects.create(
            utilisateur=self.utilisateur,
            profil='enseignant',
            grade='professeur_titulaire',
        )
        token_autre_utilisateur = signing.dumps(
            self.autre_utilisateur.pk,
            salt='notre_app.api-token',
        )

        response = self.client.get(
            '/api/membres/alice/',
            HTTP_AUTHORIZATION=f'Token {token_autre_utilisateur}',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['profil'], 'enseignant')
        self.assertEqual(response.json()['grade'], 'professeur_titulaire')

    def test_profil_enseignant_est_consultable_sans_authentification_sans_donnees_privees(self):
        ProfilUtilisateur.objects.create(
            utilisateur=self.utilisateur,
            profil='enseignant',
            grade='maitre_assistant',
        )

        response = self.client.get('/api/membres/alice/')

        self.assertEqual(response.status_code, 200)
        donnees = response.json()
        self.assertEqual(donnees['username'], 'alice')
        self.assertEqual(donnees['profil'], 'enseignant')
        self.assertEqual(donnees['grade'], 'maitre_assistant')
        self.assertNotIn('email', donnees)
        self.assertNotIn('matricule', donnees)

    def test_photo_de_profil_est_televersee_et_retournee(self):
        buffer = BytesIO()
        Image.new('RGB', (1, 1)).save(buffer, format='PNG')
        photo = SimpleUploadedFile(
            'profil.png',
            buffer.getvalue(),
            content_type='image/png',
        )

        response = self.client.post(
            '/api/comptes/moi/photo/',
            {'photo': photo},
            HTTP_AUTHORIZATION=f'Token {self.token}',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['photo'].startswith('/media/profils/'))
        profil = ProfilUtilisateur.objects.get(utilisateur=self.utilisateur)
        self.addCleanup(profil.photo.delete, save=False)
        self.assertTrue(profil.photo.storage.exists(profil.photo.name))

    def test_photo_est_incluse_dans_les_donnees_auteur_question_et_reponse(self):
        buffer = BytesIO()
        Image.new('RGB', (1, 1)).save(buffer, format='PNG')
        photo = SimpleUploadedFile(
            'profil-auteur.png',
            buffer.getvalue(),
            content_type='image/png',
        )
        televersement = self.client.post(
            '/api/comptes/moi/photo/',
            {'photo': photo},
            HTTP_AUTHORIZATION=f'Token {self.token}',
        )
        self.assertEqual(televersement.status_code, 200)
        chemin_photo = televersement.json()['photo']

        questions = self.client.get('/api/questions/')
        question = next(item for item in questions.json() if item['id'] == self.question.id)
        reponses = self.client.get(
            f'/api/questions/{self.question.id}/reponses/',
            HTTP_AUTHORIZATION=f'Token {self.token}',
        )

        self.assertEqual(question['auteur']['photo'], chemin_photo)
        self.assertEqual(reponses.json()[0]['auteur']['photo'], chemin_photo)
        profil = ProfilUtilisateur.objects.get(utilisateur=self.utilisateur)
        self.addCleanup(profil.photo.delete, save=False)

    def test_photo_invalide_est_refusee(self):
        photo = SimpleUploadedFile(
            'profil.png',
            b'pas une image',
            content_type='image/png',
        )

        response = self.client.post(
            '/api/comptes/moi/photo/',
            {'photo': photo},
            HTTP_AUTHORIZATION=f'Token {self.token}',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('photo', response.json())
        self.assertFalse(ProfilUtilisateur.objects.exists())

    def test_profil_d_un_autre_membre_ne_revele_pas_email_ni_matricule(self):
        response = self.client.get(
            '/api/membres/alice/',
            HTTP_AUTHORIZATION=(
                f"Token {signing.dumps(self.autre_utilisateur.pk, salt='notre_app.api-token')}"
            ),
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotIn('email', response.json())
        self.assertNotIn('matricule', response.json())


class FavoriQuestionApiTests(TestCase):
    def setUp(self):
        self.auteur = User.objects.create_user(username='alice', password='motdepasse')
        self.utilisateur = User.objects.create_user(username='bob', password='motdepasse')
        self.autre_utilisateur = User.objects.create_user(username='charlie', password='motdepasse')
        self.categorie = categorie.objects.create(nom='Informatique')
        self.question = Question.objects.create(
            titre='Ma question',
            contenu='Description.',
            auteur=self.auteur,
            categorie=self.categorie,
        )
        self.token = signing.dumps(self.utilisateur.pk, salt='notre_app.api-token')
        self.autre_token = signing.dumps(self.autre_utilisateur.pk, salt='notre_app.api-token')

    def basculer(self, token):
        return self.client.post(
            f'/api/questions/{self.question.id}/favori/',
            HTTP_AUTHORIZATION=f'Token {token}',
        )

    def test_favori_est_ajoute_puis_retire_et_renvoye_dans_les_questions(self):
        ajout = self.basculer(self.token)
        self.assertEqual(ajout.status_code, 200)
        self.assertTrue(ajout.json()['favori'])
        self.assertTrue(
            FavoriQuestion.objects.filter(
                question=self.question,
                utilisateur=self.utilisateur,
            ).exists()
        )

        liste = self.client.get(
            '/api/questions/',
            HTTP_AUTHORIZATION=f'Token {self.token}',
        )
        question_listee = next(item for item in liste.json() if item['id'] == self.question.id)
        self.assertTrue(question_listee['favori'])

        detail = self.client.get(
            f'/api/questions/{self.question.id}/',
            HTTP_AUTHORIZATION=f'Token {self.token}',
        )
        self.assertTrue(detail.json()['favori'])

        retrait = self.basculer(self.token)
        self.assertEqual(retrait.status_code, 200)
        self.assertFalse(retrait.json()['favori'])
        self.assertFalse(FavoriQuestion.objects.filter(question=self.question).exists())

    def test_favori_est_propre_a_chaque_utilisateur_et_requiert_authentification(self):
        self.assertEqual(
            self.client.post(f'/api/questions/{self.question.id}/favori/').status_code,
            401,
        )
        self.assertTrue(self.basculer(self.token).json()['favori'])

        detail_autre = self.client.get(
            f'/api/questions/{self.question.id}/',
            HTTP_AUTHORIZATION=f'Token {self.autre_token}',
        )
        self.assertFalse(detail_autre.json()['favori'])


class NotificationsApiTests(TestCase):
    def setUp(self):
        self.auteur = User.objects.create_user(username='alice', password='motdepasse')
        self.repondant = User.objects.create_user(username='bob', password='motdepasse')
        self.categorie = categorie.objects.create(nom='Informatique')
        self.question = Question.objects.create(
            titre='Ma question',
            contenu='Description.',
            auteur=self.auteur,
            categorie=self.categorie,
        )
        self.token_auteur = signing.dumps(self.auteur.pk, salt='notre_app.api-token')
        self.token_repondant = signing.dumps(self.repondant.pk, salt='notre_app.api-token')

    def test_publier_reponse_notifie_auteur_et_peut_etre_marquee_lue(self):
        ProfilUtilisateur.objects.create(
            utilisateur=self.repondant,
            profil='enseignant',
        )
        response = self.client.post(
            f'/api/questions/{self.question.id}/reponses/',
            data=json.dumps({'contenu': 'Voici une réponse.'}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Token {self.token_repondant}',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['auteur']['profil'], 'enseignant')
        self.assertEqual(notification.objects.filter(destinateur=self.auteur).count(), 1)

        liste = self.client.get(
            '/api/notifications/',
            HTTP_AUTHORIZATION=f'Token {self.token_auteur}',
        )
        self.assertEqual(liste.status_code, 200)
        donnees = liste.json()
        self.assertEqual(donnees['non_lues'], 1)
        self.assertEqual(donnees['notifications'][0]['type'], 'reponse')
        self.assertEqual(donnees['notifications'][0]['acteur']['username'], 'bob')
        self.assertEqual(donnees['notifications'][0]['question']['id'], self.question.id)
        self.assertEqual(donnees['notifications'][0]['question']['titre'], 'Ma question')
        reponse = Reponse.objects.get(question=self.question)
        self.assertEqual(donnees['notifications'][0]['reponse']['id'], reponse.id)

        marquage = self.client.post(
            '/api/notifications/lire/',
            data=json.dumps({'id': donnees['notifications'][0]['id']}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Token {self.token_auteur}',
        )
        self.assertEqual(marquage.status_code, 200)
        self.assertEqual(marquage.json()['non_lues'], 0)

    def test_auteur_question_ne_peut_pas_publier_une_reponse(self):
        response = self.client.post(
            f'/api/questions/{self.question.id}/reponses/',
            data=json.dumps({'contenu': 'Ma propre réponse.'}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Token {self.token_auteur}',
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json()['detail'],
            'Vous ne pouvez pas répondre à votre propre question.',
        )
        self.assertFalse(Reponse.objects.filter(question=self.question).exists())
        self.assertFalse(notification.objects.filter(destinateur=self.auteur).exists())

    def test_notification_n_est_visible_ni_modifiable_par_un_autre_compte(self):
        item = notification.objects.create(
            destinateur=self.auteur,
            acteur=self.repondant,
            question=self.question,
            message='Réponse reçue',
        )

        liste = self.client.get(
            '/api/notifications/',
            HTTP_AUTHORIZATION=f'Token {self.token_repondant}',
        )
        self.assertEqual(liste.status_code, 200)
        self.assertEqual(liste.json()['notifications'], [])

        self.client.post(
            '/api/notifications/lire/',
            data=json.dumps({'id': item.id}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Token {self.token_repondant}',
        )
        item.refresh_from_db()
        self.assertFalse(item.lue)

    def test_notifications_requierent_une_authentification(self):
        self.assertEqual(self.client.get('/api/notifications/').status_code, 401)


class AcceptationReponseApiTests(TestCase):
    def setUp(self):
        self.auteur = User.objects.create_user(username='alice', password='motdepasse')
        self.repondant = User.objects.create_user(username='bob', password='motdepasse')
        self.autre = User.objects.create_user(username='charlie', password='motdepasse')
        self.categorie = categorie.objects.create(nom='Informatique')
        self.question = Question.objects.create(
            titre='Ma question',
            contenu='Description.',
            auteur=self.auteur,
            categorie=self.categorie,
        )
        self.reponse = Reponse.objects.create(
            question=self.question,
            auteur=self.repondant,
            contenu='Voici une réponse.',
        )
        self.autre_reponse = Reponse.objects.create(
            question=self.question,
            auteur=self.autre,
            contenu='Voici une autre réponse.',
        )
        self.token_auteur = signing.dumps(self.auteur.pk, salt='notre_app.api-token')
        self.token_autre = signing.dumps(self.autre.pk, salt='notre_app.api-token')

    def accepter(self, reponse, token):
        return self.client.post(
            f'/api/reponses/{reponse.id}/accepter/',
            HTTP_AUTHORIZATION=f'Token {token}',
        )

    def test_auteur_peut_accepter_une_reponse_et_la_retirer(self):
        detail_initial = self.client.get(f'/api/questions/{self.question.id}/')
        self.assertFalse(detail_initial.json()['resolue'])

        liste_initiale = self.client.get('/api/questions/')
        question_listee = next(
            item for item in liste_initiale.json()
            if item['id'] == self.question.id
        )
        self.assertFalse(question_listee['resolue'])

        acceptee = self.accepter(self.reponse, self.token_auteur)
        self.assertEqual(acceptee.status_code, 200)
        self.assertTrue(acceptee.json()['acceptee'])

        detail = self.client.get(f'/api/questions/{self.question.id}/')
        self.assertTrue(detail.json()['resolue'])

        retiree = self.accepter(self.reponse, self.token_auteur)
        self.assertEqual(retiree.status_code, 200)
        self.assertFalse(retiree.json()['acceptee'])
        self.assertFalse(self.client.get(
            f'/api/questions/{self.question.id}/'
        ).json()['resolue'])

    def test_une_seule_reponse_peut_etre_acceptee_par_question(self):
        self.accepter(self.reponse, self.token_auteur)
        acceptee = self.accepter(self.autre_reponse, self.token_auteur)

        self.assertEqual(acceptee.status_code, 200)
        self.assertFalse(Reponse.objects.get(pk=self.reponse.pk).acceptee)
        self.assertTrue(Reponse.objects.get(pk=self.autre_reponse.pk).acceptee)

    def test_seul_auteur_de_question_connecte_peut_accepter(self):
        self.assertEqual(self.accepter(self.reponse, self.token_autre).status_code, 403)
        self.assertEqual(
            self.client.post(f'/api/reponses/{self.reponse.id}/accepter/').status_code,
            401,
        )
        self.assertFalse(Reponse.objects.get(pk=self.reponse.pk).acceptee)


class AccordReponseApiTests(TestCase):
    def setUp(self):
        self.auteur = User.objects.create_user(username='alice', password='motdepasse')
        self.votant = User.objects.create_user(username='bob', password='motdepasse')
        self.autre_votant = User.objects.create_user(username='charlie', password='motdepasse')
        self.auteur_reponse = User.objects.create_user(username='david', password='motdepasse')
        self.categorie = categorie.objects.create(nom='Informatique')
        self.question = Question.objects.create(
            titre='Ma question',
            contenu='Description.',
            auteur=self.auteur,
            categorie=self.categorie,
        )
        self.reponse = Reponse.objects.create(
            question=self.question,
            auteur=self.auteur_reponse,
            contenu='Voici une réponse.',
        )
        self.token_auteur = signing.dumps(self.auteur.pk, salt='notre_app.api-token')
        self.token_auteur_reponse = signing.dumps(self.auteur_reponse.pk, salt='notre_app.api-token')
        self.token_votant = signing.dumps(self.votant.pk, salt='notre_app.api-token')
        self.token_autre = signing.dumps(self.autre_votant.pk, salt='notre_app.api-token')

    def accorder(self, token):
        return self.client.post(
            f'/api/reponses/{self.reponse.id}/voter/',
            HTTP_AUTHORIZATION=f'Token {token}',
        )

    def test_accord_est_enregistre_annule_et_affiche_dans_les_reponses(self):
        premier_accord = self.accorder(self.token_votant)
        self.assertEqual(premier_accord.status_code, 200)
        self.assertEqual(premier_accord.json()['accords'], 1)
        self.assertTrue(premier_accord.json()['mon_accord'])
        self.assertEqual(
            premier_accord.json()['personnes_accord'],
            [{'username': 'bob', 'prenom': '', 'nom': ''}],
        )
        self.assertEqual(
            notification.objects.filter(
                destinateur=self.auteur_reponse,
                acteur=self.votant,
                type='accord_reponse',
            ).count(),
            1,
        )

        liste = self.client.get(
            f'/api/questions/{self.question.id}/reponses/',
            HTTP_AUTHORIZATION=f'Token {self.token_votant}',
        )
        reponse_listee = next(item for item in liste.json() if item['id'] == self.reponse.id)
        self.assertEqual(reponse_listee['accords'], 1)
        self.assertTrue(reponse_listee['mon_accord'])
        self.assertEqual(reponse_listee['personnes_accord'][0]['username'], 'bob')

        annulation = self.accorder(self.token_votant)
        self.assertEqual(annulation.json()['accords'], 0)
        self.assertFalse(annulation.json()['mon_accord'])
        self.assertEqual(annulation.json()['personnes_accord'], [])
        self.assertEqual(AccordReponse.objects.filter(reponse=self.reponse).count(), 0)
        self.assertEqual(
            notification.objects.filter(
                destinateur=self.auteur_reponse,
                acteur=self.votant,
                type='accord_reponse',
            ).count(),
            1,
        )

    def test_notification_de_vote_contient_acteur_et_question(self):
        self.accorder(self.token_votant)

        liste = self.client.get(
            '/api/notifications/',
            HTTP_AUTHORIZATION=f'Token {self.token_auteur_reponse}',
        )

        self.assertEqual(liste.status_code, 200)
        self.assertEqual(liste.json()['non_lues'], 1)
        notification_vote = liste.json()['notifications'][0]
        self.assertEqual(notification_vote['type'], 'accord_reponse')
        self.assertEqual(notification_vote['acteur']['username'], 'bob')
        self.assertEqual(notification_vote['question']['id'], self.question.id)
        self.assertEqual(notification_vote['question']['titre'], 'Ma question')
        self.assertEqual(notification_vote['reponse']['id'], self.reponse.id)

    def test_accords_de_plusieurs_personnes_sont_cumules(self):
        self.accorder(self.token_votant)
        resultat = self.accorder(self.token_autre)
        self.assertEqual(resultat.json()['accords'], 2)
        self.assertTrue(resultat.json()['mon_accord'])
        self.assertEqual(
            [personne['username'] for personne in resultat.json()['personnes_accord']],
            ['bob', 'charlie'],
        )

        liste = self.client.get(
            f'/api/questions/{self.question.id}/reponses/',
            HTTP_AUTHORIZATION=f'Token {self.token_votant}',
        )
        reponse_listee = next(item for item in liste.json() if item['id'] == self.reponse.id)
        self.assertEqual(reponse_listee['accords'], 2)
        self.assertTrue(reponse_listee['mon_accord'])

        questions = self.client.get('/api/questions/')
        question_listee = next(item for item in questions.json() if item['id'] == self.question.id)
        self.assertEqual(question_listee['accords'], 2)

        detail = self.client.get(f'/api/questions/{self.question.id}/')
        self.assertEqual(detail.json()['accords'], 2)

    def test_accord_requiert_compte_et_interdit_sa_propre_reponse(self):
        sans_auth = self.client.post(
            f'/api/reponses/{self.reponse.id}/voter/',
        )
        self.assertEqual(sans_auth.status_code, 401)
        self.assertEqual(self.accorder(self.token_auteur_reponse).status_code, 403)
        self.assertEqual(self.accorder(self.token_votant).status_code, 200)
        self.assertEqual(AccordReponse.objects.filter(reponse=self.reponse).count(), 1)

    def test_auteur_question_ne_peut_pas_voter_une_reponse(self):
        resultat = self.accorder(self.token_auteur)

        self.assertEqual(resultat.status_code, 403)
        self.assertEqual(
            resultat.json()['detail'],
            'Vous ne pouvez pas voter pour une réponse à votre propre question.',
        )
        self.assertFalse(
            AccordReponse.objects.filter(
                reponse=self.reponse,
                utilisateur=self.auteur,
            ).exists()
        )


class AdminForumApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin',
            password='test',
            is_staff=True,
        )
        self.utilisateur = User.objects.create_user(username='alice', password='test')
        self.categorie = categorie.objects.create(nom='Informatique')
        self.question = Question.objects.create(
            titre='Question de test',
            contenu='Contenu de test',
            auteur=self.utilisateur,
            categorie=self.categorie,
        )
        self.reponse = Reponse.objects.create(
            question=self.question,
            auteur=self.utilisateur,
            contenu='Réponse de test',
        )
        self.token_admin = signing.dumps(self.admin.pk, salt='notre_app.api-token')
        self.token_utilisateur = signing.dumps(self.utilisateur.pk, salt='notre_app.api-token')

    def post_json(self, url, data, token=None):
        headers = {'HTTP_AUTHORIZATION': f'Token {token}'} if token else {}
        return self.client.post(
            url,
            data=json.dumps(data),
            content_type='application/json',
            **headers,
        )

    def test_tableau_admin_refuse_les_visiteurs_et_comptes_normaux(self):
        sans_auth = self.client.get('/api/admin/forum/')
        non_admin = self.client.get(
            '/api/admin/forum/',
            HTTP_AUTHORIZATION=f'Token {self.token_utilisateur}',
        )
        admin = self.client.get(
            '/api/admin/forum/',
            HTTP_AUTHORIZATION=f'Token {self.token_admin}',
        )

        self.assertEqual(sans_auth.status_code, 401)
        self.assertEqual(non_admin.status_code, 403)
        self.assertEqual(admin.status_code, 200)
        self.assertEqual(admin.json()['questions'][0]['titre'], self.question.titre)
        self.assertTrue(admin.json()['utilisateurs'][0]['is_staff'])

    def test_admin_peut_gerer_categories_et_matricules(self):
        categorie_creee = self.post_json(
            '/api/admin/categories/',
            {'nom': 'Mathématiques'},
            token=self.token_admin,
        )
        self.assertEqual(categorie_creee.status_code, 201)
        categorie_id = categorie_creee.json()['id']

        categorie_modifiee = self.client.patch(
            f'/api/admin/categories/{categorie_id}/',
            data=json.dumps({'nom': 'Maths'}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Token {self.token_admin}',
        )
        self.assertEqual(categorie_modifiee.status_code, 200)
        self.assertEqual(categorie_modifiee.json()['nom'], 'Maths')

        categorie_utilisee = self.client.delete(
            f'/api/admin/categories/{self.categorie.id}/',
            HTTP_AUTHORIZATION=f'Token {self.token_admin}',
        )
        self.assertEqual(categorie_utilisee.status_code, 409)

        matricule_cree = self.post_json(
            '/api/admin/matricules/',
            {'numero': 'ETU-002'},
            token=self.token_admin,
        )
        self.assertEqual(matricule_cree.status_code, 201)
        matricule_id = matricule_cree.json()['id']
        matricule_supprime = self.client.delete(
            f'/api/admin/matricules/{matricule_id}/',
            HTTP_AUTHORIZATION=f'Token {self.token_admin}',
        )
        self.assertEqual(matricule_supprime.status_code, 204)

    def test_admin_peut_creer_un_compte_enseignant_connectable_par_email(self):
        compte = self.post_json(
            '/api/admin/enseignants/',
            {
                'prenom': 'Claire',
                'nom': 'Dupont',
                'email': 'claire.dupont@example.com',
                'password': 'Qv!7mP#3Lz2026x',
            },
            token=self.token_admin,
        )

        self.assertEqual(compte.status_code, 201)
        self.assertEqual(compte.json()['profil'], 'enseignant')
        self.assertEqual(compte.json()['email'], 'claire.dupont@example.com')
        self.assertNotIn('password', compte.json())
        enseignant = User.objects.get(email='claire.dupont@example.com')
        self.assertEqual(enseignant.first_name, 'Claire')
        self.assertEqual(enseignant.last_name, 'Dupont')
        self.assertTrue(enseignant.check_password('Qv!7mP#3Lz2026x'))
        self.assertEqual(enseignant.profil_utilisateur.profil, 'enseignant')

        connexion = self.post_json('/api/comptes/connexion/', {
            'identifier': 'claire.dupont@example.com',
            'password': 'Qv!7mP#3Lz2026x',
        })
        self.assertEqual(connexion.status_code, 200)
        self.assertEqual(connexion.json()['utilisateur']['profil'], 'enseignant')
        utilisateurs = self.client.get(
            '/api/admin/forum/',
            HTTP_AUTHORIZATION=f'Token {self.token_admin}',
        ).json()['utilisateurs']
        ligne_enseignant = next(item for item in utilisateurs if item['id'] == enseignant.id)
        self.assertEqual(ligne_enseignant['profil'], 'enseignant')

    def test_creation_enseignant_est_reservee_aux_administrateurs(self):
        resultat = self.post_json(
            '/api/admin/enseignants/',
            {
                'prenom': 'Claire',
                'nom': 'Dupont',
                'email': 'claire.dupont@example.com',
                'password': 'Qv!7mP#3Lz2026x',
            },
            token=self.token_utilisateur,
        )

        self.assertEqual(resultat.status_code, 403)
        self.assertFalse(User.objects.filter(email='claire.dupont@example.com').exists())

    def test_creation_enseignant_refuse_email_deja_utilise_ou_mot_de_passe_faible(self):
        self.utilisateur.email = 'alice@example.com'
        self.utilisateur.save(update_fields=['email'])
        doublon = self.post_json(
            '/api/admin/enseignants/',
            {
                'prenom': 'Claire',
                'nom': 'Dupont',
                'email': 'ALICE@example.com',
                'password': 'Qv!7mP#3Lz2026x',
            },
            token=self.token_admin,
        )
        faible = self.post_json(
            '/api/admin/enseignants/',
            {
                'prenom': 'Claire',
                'nom': 'Dupont',
                'email': 'claire.dupont@example.com',
                'password': 'password',
            },
            token=self.token_admin,
        )

        self.assertEqual(doublon.status_code, 400)
        self.assertIn('email', doublon.json())
        self.assertEqual(faible.status_code, 400)
        self.assertIn('password', faible.json())

    def test_admin_peut_supprimer_question_reponse_et_utilisateur(self):
        reponse_supprimee = self.client.delete(
            f'/api/admin/reponses/{self.reponse.id}/',
            HTTP_AUTHORIZATION=f'Token {self.token_admin}',
        )
        self.assertEqual(reponse_supprimee.status_code, 204)
        self.assertFalse(Reponse.objects.filter(pk=self.reponse.id).exists())

        question_supprimee = self.client.delete(
            f'/api/admin/questions/{self.question.id}/',
            HTTP_AUTHORIZATION=f'Token {self.token_admin}',
        )
        self.assertEqual(question_supprimee.status_code, 204)
        self.assertFalse(Question.objects.filter(pk=self.question.id).exists())

        utilisateur_supprime = self.client.delete(
            f'/api/admin/utilisateurs/{self.utilisateur.id}/',
            HTTP_AUTHORIZATION=f'Token {self.token_admin}',
        )
        self.assertEqual(utilisateur_supprime.status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.utilisateur.id).exists())

    def test_admin_ne_peut_pas_supprimer_son_compte(self):
        resultat = self.client.delete(
            f'/api/admin/utilisateurs/{self.admin.id}/',
            HTTP_AUTHORIZATION=f'Token {self.token_admin}',
        )

        self.assertEqual(resultat.status_code, 403)
        self.assertTrue(User.objects.filter(pk=self.admin.id).exists())
